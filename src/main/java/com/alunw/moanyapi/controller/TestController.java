package com.alunw.moanyapi.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.security.RolesAllowed;
import javax.servlet.http.HttpServletRequest;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/test")
@CrossOrigin(origins = "*")
public class TestController {

    private static final Logger logger = LoggerFactory.getLogger(TestController.class);
    private static final String MESSAGE_KEY = "message";

    @RequestMapping(value = "/anonymous", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAnonymous(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello Anonymous");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("user")
    @RequestMapping(value = "/user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getUser(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello User");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("admin")
    @RequestMapping(value = "/admin", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAdmin(HttpServletRequest request) {
        Map<String, Object> userInfo = getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello " + userInfo.get("firstName") + " " + userInfo.get("lastName") +  " [admin]");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed({"admin","user"})
    @RequestMapping(value = "/all-user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAllUser(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello All Users");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/auth")
    public Principal retrievePrincipal(Principal principal) {
        return principal;
    }

    private Map<String, Object> getUserInfo(HttpServletRequest request) {
        Map<String, Object> results = new HashMap<>();
//        KeycloakAuthenticationToken token = (KeycloakAuthenticationToken) request.getUserPrincipal();
//        if (token != null) {
//            KeycloakPrincipal<?> principal = (KeycloakPrincipal<?>) token.getPrincipal();
//            KeycloakSecurityContext session = principal.getKeycloakSecurityContext();
//            AccessToken accessToken = session.getToken();
//            results.put("username", accessToken.getPreferredUsername());
//            results.put("email", accessToken.getEmail());
//            results.put("lastName", accessToken.getFamilyName());
//            results.put("firstName", accessToken.getGivenName());
//            results.put("realmName", accessToken.getIssuer());
//            AccessToken.Access realmAccess = accessToken.getRealmAccess();
//            results.put("roles", realmAccess.getRoles());
//        }
        logger.info("User info = {}", results);
        return results;
    }
}
