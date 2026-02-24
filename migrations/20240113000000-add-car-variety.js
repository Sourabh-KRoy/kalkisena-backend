module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum types if not exists (idempotent for re-runs or when column already exists)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."enum_vehicles_car_variety" AS ENUM ('car_plus', 'car_lite', 'taxi');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."enum_rides_car_variety" AS ENUM ('car_plus', 'car_lite', 'taxi');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add columns only if they don't exist
    await queryInterface.sequelize.query(`
      ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "car_variety" "public"."enum_vehicles_car_variety"
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "car_variety" "public"."enum_rides_car_variety"
    `);

    // Create indexes only if they don't exist
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "vehicles_car_variety_index" ON "vehicles" ("car_variety")
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "rides_car_variety_index" ON "rides" ("car_variety")
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('vehicles', 'vehicles_car_variety_index');
    await queryInterface.removeIndex('rides', 'rides_car_variety_index');
    await queryInterface.removeColumn('vehicles', 'car_variety');
    await queryInterface.removeColumn('rides', 'car_variety');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_vehicles_car_variety";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rides_car_variety";');
  }
};
