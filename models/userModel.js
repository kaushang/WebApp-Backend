<<<<<<< HEAD
const mongoose = require('mongoose');
// mongoose.connect('mongodb://localhost:27017/users');

const userSchema = mongoose.Schema({
    email: String,
    username: String,
    name: String,
    password: String,
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ]
});

module.exports = mongoose.model("user", userSchema);
=======
const mongoose = require('mongoose');
// mongoose.connect('mongodb://localhost:27017/users');

const userSchema = mongoose.Schema({
    email: String,
    username: String,
    name: String,
    password: String,
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ]
});

module.exports = mongoose.model("user", userSchema);
>>>>>>> 83fa5d85edb70ac2fd9b912e96b66898c974a188
