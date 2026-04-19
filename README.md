# docker-compose-template

MyServers docker compose template repository.

## Layout

- `templates/index.json`: template registry
- `templates/<id>/docker-compose.yaml`: compose template
- `templates/<id>/args.json`: args schema and repeatable groups

## Generate

Use the local generator when adding or updating templates:

```bash
node generate-templates.mjs
```
