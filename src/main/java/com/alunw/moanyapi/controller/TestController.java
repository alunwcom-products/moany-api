package com.alunw.moanyapi.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.security.RolesAllowed;
import javax.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/test")
@CrossOrigin(origins = "http://localhost:3000/")
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

//    @RolesAllowed("user")
    @RequestMapping(value = "/user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getUser(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello User");
        return ResponseEntity.ok(result);
    }

//    @RolesAllowed("admin")
    @CrossOrigin
    @RequestMapping(value = "/admin", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAdmin(HttpServletRequest request) {
        Map<String, Object> userInfo = getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello " + userInfo.get("firstName") + " " + userInfo.get("lastName") +  " [admin]");
        return ResponseEntity.ok(result);
    }

//    @RolesAllowed({"admin","user"})
    @RequestMapping(value = "/all-user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAllUser(HttpServletRequest request, @AuthenticationPrincipal Jwt jwt) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put(MESSAGE_KEY, "Hello All Users");
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> getUserInfo(HttpServletRequest request) {
        Map<String, Object> results = new HashMap<>();
        logger.info("Principal: " + request.getUserPrincipal());
        JwtAuthenticationToken jwt2 = (JwtAuthenticationToken) request.getUserPrincipal();
        Jwt jwt = jwt2.getToken();
        logger.info("token: " + jwt.getClaims());

//        KeycloakAuthenticationToken token = (KeycloakAuthenticationToken) request.getUserPrincipal();
//        KeycloakPrincipal<?> principal = (KeycloakPrincipal<?>) token.getPrincipal();
//        KeycloakSecurityContext session = principal.getKeycloakSecurityContext();
//        AccessToken accessToken = session.getToken();
//        results.put("username", accessToken.getPreferredUsername());
//        results.put("email", accessToken.getEmail());
        results.put("lastName", jwt.getClaimAsString("family_name"));
        results.put("firstName", jwt.getClaimAsString("given_name"));
//        results.put("realmName", accessToken.getIssuer());
//        AccessToken.Access realmAccess = accessToken.getRealmAccess();
//        results.put("roles", realmAccess.getRoles());
        logger.info("User info = {}", results);
        return results;
    }
}
