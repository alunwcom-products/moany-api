# README :: moany-api

## Overview

The moany-api forms the back-end API for the Moany application. Currently under initial development to replace the 
older moany application.

## Development Notes

### Branches

- production: Default, protected branch (requiring pull requests). This will be deployed to LIVE on merge.
- uat: UAT branch, for work-in-progress. this will be deployed to uAT on commit.

### AuthN/AuthZ

Using https://auth.alunw.com/auth as Keycloak server

- For moany-api: client_id = moany-api
- For front-end: client_id = moany-fe

### Dependency updates

> .\gradlew.bat dependencyUpdates -Drevision=release

> .\gradlew.bat wrapper --gradle-version 7.4.1