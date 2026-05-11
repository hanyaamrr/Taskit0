package com.springdemo.taskmanager2.DTO;

import lombok.Data;

@Data
public class AuthRequest {
    private String email;
    private String password;
    private String username;

    public String getEmail(){
        return email;
    }
    public String getPass(){
        return password;
    }
    public String username(){
        return username;
    }
}
