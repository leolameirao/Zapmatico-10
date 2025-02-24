import { QueryInterface, DataTypes } from "sequelize";

module.exports = {

  up: (queryInterface: QueryInterface) => {
    return Promise.all([

      queryInterface.addColumn("Whatsapps", "useTypebot", {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }),

      queryInterface.addColumn("Whatsapps", "sessionName", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "useTypebot"),
      queryInterface.removeColumn("Whatsapps", "sessionName")
    ]);
  }

};
