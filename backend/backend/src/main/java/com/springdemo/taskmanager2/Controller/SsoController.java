package com.springdemo.taskmanager2.Controller;

import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.springdemo.taskmanager2.Model.User;
import com.springdemo.taskmanager2.Repository.UserRepository;
import com.springdemo.taskmanager2.Security.JwtUtil;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/auth/sso")
@RequiredArgsConstructor
public class SsoController {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;



    @GetMapping("/success")
    public void success(@AuthenticationPrincipal OAuth2User oauthUser, HttpServletResponse httpResponse) throws IOException {

        String email = oauthUser.getAttribute("email");
        String name = oauthUser.getAttribute("name");

        User user = userRepository.findByEmail(email).orElseGet(() -> { 
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setName(name);
            newUser.setOauthProvider("GOOGLE");
            newUser.setPassword("");
            return userRepository.save(newUser);
        });

        String token = jwtUtil.generateToken(user.getEmail());

        String encodedName = URLEncoder.encode(user.getName(), StandardCharsets.UTF_8);
        String encodedEmail = URLEncoder.encode(user.getEmail(), StandardCharsets.UTF_8);

        httpResponse.sendRedirect("http://localhost:5173?token=" + token + "&name=" + encodedName + "&email=" + encodedEmail);
    }
}
