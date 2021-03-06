package com.alunw.moanyapi.controller;

import org.keycloak.KeycloakPrincipal;
import org.keycloak.KeycloakSecurityContext;
import org.keycloak.adapters.springsecurity.token.KeycloakAuthenticationToken;
import org.keycloak.representations.AccessToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpRequest;
import org.springframework.http.ResponseEntity;
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
@CrossOrigin(origins = "*")
public class TestController {

    private static final Logger logger = LoggerFactory.getLogger(TestController.class);

    @RequestMapping(value = "/anonymous", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAnonymous(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello Anonymous");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("user")
    @RequestMapping(value = "/user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getUser(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello User");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed("admin")
    @RequestMapping(value = "/admin", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAdmin(HttpServletRequest request) {
        Map<String, Object> userInfo = getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello " + userInfo.get("firstName") + " " + userInfo.get("lastName") +  " [admin]");
        return ResponseEntity.ok(result);
    }

    @RolesAllowed({"admin","user"})
    @RequestMapping(value = "/all-user", method = RequestMethod.GET)
    public ResponseEntity<Map<String, String>> getAllUser(HttpServletRequest request) {
        getUserInfo(request);
        Map<String, String> result = new HashMap<>();
        result.put("message", "Hello All Users");
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> getUserInfo(HttpServletRequest request) {
        Map<String, Object> results = new HashMap<>();
        KeycloakAuthenticationToken token = (KeycloakAuthenticationToken) request.getUserPrincipal();
        KeycloakPrincipal principal=(KeycloakPrincipal)token.getPrincipal();
        KeycloakSecurityContext session = principal.getKeycloakSecurityContext();
        AccessToken accessToken = session.getToken();
        results.put("username", accessToken.getPreferredUsername());
        results.put("email", accessToken.getEmail());
        results.put("lastName", accessToken.getFamilyName());
        results.put("firstName", accessToken.getGivenName());
        results.put("realmName", accessToken.getIssuer());
        AccessToken.Access realmAccess = accessToken.getRealmAccess();
        results.put("roles", realmAccess.getRoles());
        logger.info("User info = {}", results);
        return results;
    }
}
