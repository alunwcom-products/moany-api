package com.alunw.moanyapi.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.security.RolesAllowed;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/test")
@CrossOrigin(origins = "*")
public class TestController {

    @RequestMapping(value = "/anonymous", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAnonymous() {
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello Anonymous");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("user")
    @RequestMapping(value = "/user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getUser() {
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello User");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("admin")
    @RequestMapping(value = "/admin", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAdmin() {
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello Admin");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed({"admin","user"})
    @RequestMapping(value = "/all-user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAllUser() {
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello All Users");
        return ResponseEntity.ok(result);
    }
}
