# Database Migration Guide

This guide explains how to run database migrations in different environments.

## Prerequisites

1. Make sure you have `sequelize-cli` installed:
   ```bash
   npm install -g sequelize-cli
   # or use local installation
   npm install
   ```

2. Set up your environment variables in `.env` file:
   ```env
   NODE_ENV=production
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db_name
   DB_HOST=your_db_host
   ```

## Running Migrations

### Development Environment

```bash
# Run all pending migrations
npm run migrate

# Or using sequelize-cli directly
NODE_ENV=development sequelize-cli db:migrate
```

### Production Environment

**⚠️ IMPORTANT: Always backup your production database before running migrations!**

#### Option 1: Using npm script (Recommended)

```bash
# Set production environment
NODE_ENV=production npm run migrate
```

#### Option 2: Using sequelize-cli directly

```bash
NODE_ENV=production sequelize-cli db:migrate
```

#### Option 3: On Production Server

1. SSH into your production server
2. Navigate to your project directory
3. Pull the latest code (including new migrations)
4. Run migrations:
   ```bash
   NODE_ENV=production npm run migrate
   ```

## Rolling Back Migrations

If you need to undo the last migration:

```bash
# Development
npm run migrate:undo

# Production (use with caution!)
NODE_ENV=production npm run migrate:undo
```

To undo multiple migrations:
```bash
NODE_ENV=production sequelize-cli db:migrate:undo:all
```

## Checking Migration Status

To see which migrations have been run:

```bash
NODE_ENV=production sequelize-cli db:migrate:status
```

## New Migration Created

A new migration has been created for the `user_addresses` table:
- **File**: `migrations/20240116000000-create-user-addresses.js`
- **Table**: `user_addresses`
- **Purpose**: Stores user delivery addresses for book purchases

## Migration Checklist for Production

Before running migrations in production:

- [ ] Backup production database
- [ ] Test migrations in staging/development first
- [ ] Review migration file for any potential issues
- [ ] Ensure database credentials are correct in `.env`
- [ ] Schedule maintenance window if needed
- [ ] Monitor application logs during migration
- [ ] Verify data integrity after migration

## Troubleshooting

### Migration fails with "relation already exists"
This means the table already exists. You can either:
1. Skip this migration if the table structure matches
2. Modify the migration to check if table exists first
3. Drop and recreate (⚠️ will lose data)

### Connection timeout
- Check database credentials
- Verify network connectivity
- Ensure database server is running
- Check firewall rules

### Permission denied
- Verify database user has CREATE TABLE permissions
- Check user has access to the database

## Best Practices

1. **Always test migrations locally first**
2. **Backup before production migrations**
3. **Run migrations during low-traffic periods**
4. **Monitor application after migration**
5. **Keep migration files in version control**
6. **Never modify executed migrations** (create new ones instead)
