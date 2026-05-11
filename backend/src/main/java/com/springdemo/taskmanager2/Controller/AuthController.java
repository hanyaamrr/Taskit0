package com.springdemo.taskmanager2.Controller;

import com.springdemo.taskmanager2.DTO.AuthRequest;
import com.springdemo.taskmanager2.DTO.AuthResponse;
import com.springdemo.taskmanager2.Model.User;
import com.springdemo.taskmanager2.Repository.UserRepository;
import com.springdemo.taskmanager2.Security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Email already exists"));
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getUsername());
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail());
        AuthResponse response = new AuthResponse(token, user.getEmail(), user.getName());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {

        User user = userRepository.findByEmail(request.getEmail())
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid credentials"));
        }

        String token = jwtUtil.generateToken(user.getEmail());
        AuthResponse response = new AuthResponse(token, user.getEmail(), user.getName());
        return ResponseEntity.ok(response);
    }
}

