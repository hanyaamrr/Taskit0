package com.springdemo.taskmanager2.Controller;

import com.springdemo.taskmanager2.Model.Task;
import com.springdemo.taskmanager2.Model.User;
import com.springdemo.taskmanager2.Repository.TaskRepository;
import com.springdemo.taskmanager2.Repository.UserRepository;
import com.springdemo.taskmanager2.Security.AesUtil;
import com.springdemo.taskmanager2.Security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private AesUtil aesUtil;

    private int requestCount = 0;
    private long lastReset = System.currentTimeMillis();

    
    private User getCurrentUser(String token) {

        if (token == null || token.isBlank()) {
            log.warn("Invalid token attempt");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing token");
        }
        if (!jwtUtil.validate(token)) {
            log.warn("Invalid token attempt");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }
        String email = jwtUtil.extractEmail(token);

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }


    @GetMapping
    public ResponseEntity<List<Task>> getTasks(@RequestHeader("Authorization") String auth) {
        checkRateLimit();
        String token = auth.replace("Bearer ", "");
        User user = getCurrentUser(token);
        List<Task> tasks = taskRepository.findByUserId(user.getId());
        tasks.forEach(t -> {
            if (t.getDescription() != null) {
                t.setDescription(aesUtil.decrypt(t.getDescription()));  //decrypting before retrieving
            }
        });
        return ResponseEntity.ok(tasks);
    }


    @PostMapping
    public ResponseEntity<?> createTask(
            @RequestBody Task task,
            @RequestHeader("Authorization") String auth) {
        try {
            checkRateLimit();
            String token = auth.replace("Bearer ", "");
            User user = getCurrentUser(token);

            String rawTitle = task.getTitle() != null ? task.getTitle() : "Untitled";
            String rawDesc = task.getDescription() != null ? task.getDescription() : "";

            String sanitizedTitle = rawTitle.replaceAll("<", "&lt;");
            String sanitizedDescription = rawDesc.replaceAll("<", "&lt;");

            String encryptedDescription = "";
            if (!sanitizedDescription.isEmpty()) {
                encryptedDescription = aesUtil.encrypt(sanitizedDescription);
            }

            task.setUser(user);
            task.setTitle(sanitizedTitle);
            task.setDescription(encryptedDescription);
            taskRepository.save(task);
            log.info("Saving task for user: {}", user.getEmail());
            if (task.getDescription() != null && !task.getDescription().isEmpty()) {
                task.setDescription(aesUtil.decrypt(task.getDescription()));
            }

            return ResponseEntity.ok(task);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }


    @PutMapping("/{id}")
    public ResponseEntity<?> updateTask(
            @PathVariable Long id,
            @RequestBody Task taskDetails,
            @RequestHeader("Authorization") String authHeader) {

        checkRateLimit();
        String token = authHeader.replace("Bearer ", "");
        User user = getCurrentUser(token);

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        if (!task.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this task");
        }

        if (taskDetails.getTitle() != null) {
            task.setTitle(taskDetails.getTitle().replaceAll("<", "&lt;"));
        }

        if (taskDetails.getDescription() != null) {
            String sanitized = taskDetails.getDescription().replaceAll("<", "&lt;");
            task.setDescription(aesUtil.encrypt(sanitized));
        }

        if (taskDetails.getCompleted() != null) {
            task.setCompleted(taskDetails.getCompleted());
        }

        Task updatedTask = taskRepository.save(task);

        if (updatedTask.getDescription() != null && !updatedTask.getDescription().isEmpty()) {
            try {
                updatedTask.setDescription(aesUtil.decrypt(updatedTask.getDescription()));
            } catch (Exception e) {
            }
        }

        log.info("User {} updated task {}", user.getEmail(), id);

        return ResponseEntity.ok(updatedTask);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {
        checkRateLimit();
        String token = authHeader.replace("Bearer ", "");
        User user = getCurrentUser(token);

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        if (!task.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this task");
        }

        taskRepository.delete(task);

        System.out.println("made changes!");

        return ResponseEntity.noContent().build();
    }

    private void checkRateLimit() { //DOS protection
        long now = System.currentTimeMillis();

        if (now - lastReset > 60000) {  // reset every minute
            requestCount = 0;
            lastReset = now;
        }

        if (requestCount > 100) { // allow 100 requests per minute
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
        }

        requestCount++;
    }

}
