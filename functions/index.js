const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.cleanupGameOnHostDisconnect = functions.database
    .ref("/presence/{gameCode}/{hostUid}")
    .onDelete(async (snapshot, context) => {
      const {gameCode} = context.params;
      const firestore = admin.firestore();
      try {
        await firestore.collection("games").doc(gameCode).delete();
        console.log(
            `Deleted Firestore game document for code: ${gameCode}`,
        );
      } catch (err) {
        console.error(
            "Error deleting Firestore game:",
            err,
        );
      }
      return null;
    });
