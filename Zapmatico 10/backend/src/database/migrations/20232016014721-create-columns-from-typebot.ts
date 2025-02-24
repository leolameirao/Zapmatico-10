import { QueryInterface, DataTypes } from "sequelize";

module.exports = {

  up: (queryInterface: QueryInterface) => {
    return Promise.all([

      queryInterface.addColumn("TicketTraking", "inTypebot", {
        type: DataTypes.BOOLEAN,
        defaultValue: null,
        allowNull: true
      }),


    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("TicketTraking", "inTypebot"),
    ]);
  }

};
