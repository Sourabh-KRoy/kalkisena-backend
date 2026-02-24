module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the enum type for users_type if it doesn't exist
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_users_users_type" AS ENUM ('driver', 'users', 'admin', 'hotel');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add the users_type column with default value 'users'
    await queryInterface.sequelize.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "users_type" "enum_users_users_type" 
      NOT NULL DEFAULT 'users';
    `);

    // Add comment to the column
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN "users"."users_type" IS 'Type of user: driver, users, admin, or hotel';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove the column
    await queryInterface.removeColumn('users', 'users_type');
    
    // Drop the enum type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_users_type";');
  }
};
