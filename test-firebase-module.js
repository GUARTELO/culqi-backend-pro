const firebase = require("./src/core/config/firebase.js");
console.log("Firebase status:", firebase.getStatus());
console.log("Firestore disponible:", !!firebase.firestore);

if (firebase.firestore) {
  firebase.firestore.listCollections()
    .then(cols => console.log("Colecciones:", cols.length))
    .catch(err => console.log("Error:", err.message));
}
