"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("rooms", "property_id", {
      type: Sequelize.INTEGER,
      allowNull: true, // Initially nullable
      references: {
        model: "properties",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("rooms", "property_id");
  }
};
