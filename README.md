# README

Migrate `moany` functionality to a new NodeJS API that can be used by a separate front-end.

## Usage

API must be configured in `.env` (see `.env.sample` for example values).

```
% npm i
...

% node run start
...
```

Docker deployment

```
$ docker run -d -p 127.0.0.1:8080:3000 --network=db-network --env-file .env.db-network --restart unless-stopped --name moany-api live moany-api
...
```
