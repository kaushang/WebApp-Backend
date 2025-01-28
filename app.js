const express = require('express');
const app = express();
const path = require('path');
const port = 3000;
const userModel = require('./models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const postModel = require('./models/postModel');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get('/', isLoggedIn, (req, res) => {
    if (req.user.email) {
        res.redirect('/home');
    } else {
        res.render('index');
    }
});

app.post('/create', async (req, res) => {
    const { email, username, name, password } = req.body;
    const alreadyCreated = await userModel.findOne({ email });
    if (alreadyCreated) {
        return res.status(404).send("User already exists :(");
    } else {
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(password, salt, async (err, hash) => {
                await userModel.create({
                    email,
                    username,
                    name,
                    password: hash
                });
                let token = jwt.sign({ email }, 'xyz');
                res.cookie("token", token);
                res.redirect('/home');
            });
        });
    }
});

app.get('/login', isLoggedIn, (req, res) => {
    if (req.user.email) {
        res.redirect('/home');
    } else {
        res.render('login');
    }
});

app.post('/login', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        res.redirect('/home');
    } else {
        const user = await userModel.findOne({ email: req.body.email });
        if (!user) {
            res.status(404).json({ message: "User does not exist" });
        } else {
            bcrypt.compare(req.body.password, user.password, (err, result) => {
                if (result) {
                    let token = jwt.sign({ email: user.email }, 'xyz');
                    res.cookie("token", token);
                    res.status(200).json({ message: "Seccuessfully logged in" });
                } else {
                    return res.status(400).json({ message: "Wrong email or password" });
                }
            });
        }
    }
});

app.get('/logout', (req, res) => {
    res.cookie("token", "");
    res.redirect('/login');
});

app.get('/home', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email }).populate('posts');
        const post = await postModel.find({ user: user._id });
        res.render('home', { user, post });
    } else {
        res.redirect('/login');
    }
});

app.post('/post', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        const post = await postModel.create({
            user: user._id,
            content: req.body.content
        });
        user.posts.push(post._id);
        await user.save();
        res.redirect("/home");
    } else {
        res.redirect('/login');
    }
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email }).populate('posts');
        const post = await postModel.findById(req.params.id);
        res.render('edit', { user, post });
    } else {
        res.redirect('/login');
    }
});

app.post('/update/:id', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
        res.redirect("/home");
    } else {
        res.redirect('/login');
    }
});

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const post = await postModel.findById(req.params.id);
        await postModel.findByIdAndDelete(req.params.id);
        await userModel.updateOne(
            { _id: post.user }, // Find the user who owns the post
            { $pull: { posts: req.params.id } } // Remove the post ID from the array
        );
        res.redirect("/home");
    } else {
        res.render('login');
    }
});

app.get("/account", isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        res.render('account', { user });
    } else {
        res.redirect('/login');
    }
});

app.post("/updatepassword", isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        bcrypt.compare(req.body.currentPassword, user.password, (err, result) => {
            if (result) {
                if (req.body.currentPassword === req.body.newPassword) {
                    return res.status(400).json({ message: "New password can not be same as old password" });
                }
                if (req.body.newPassword === req.body.newPasswordAgain) {
                    bcrypt.genSalt(10, (err, salt) => {
                        bcrypt.hash(req.body.newPassword, salt, async (err, hash) => {
                            await userModel.findOneAndUpdate({ email: req.user.email }, { password: hash });
                            return res.status(200).json({ message: "Password updated successfully" });
                        });
                    });
                }
                else {
                    return res.status(400).json({ message: "New passwords do not match" });
                }

            } else {
                return res.status(400).json({ message: "Incorrect current password" });
            }
        });
    } else {
        return res.status(401).json({ message: "User not logged in" });
    }
});

app.post("/deleteaccount", isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        bcrypt.compare(req.body.currentPassword, user.password, async (err, result) => {
            if (result) {
                res.cookie("token", "");
                await userModel.findOneAndDelete({ email: req.user.email });
                await postModel.deleteMany({ user: user._id });
                res.status(200).json({ message: "Account deleted" });
            }
            else {
                return res.status(400).json({ message: "Wrong password" });
            }
        });
    } else {
        res.redirect('/login');
    }
});

function isLoggedIn(req, res, next) {
    if (!req.cookies || !req.cookies.token) {
        req.user = { status: "Not logged in" };
        next();
    } else {
        let data = jwt.verify(req.cookies.token, "xyz");
        req.user = data;
        next();
    }
}

app.listen(port, () => {
    console.log('Server running at port: ', port);
});