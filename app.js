const express = require('express');
const app = express();
const path = require('path');
const port = 3000;
const userModel = require('./models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const postModel = require('./models/postModel');
const cors = require("cors");

const mongoose = require('mongoose');
const { type } = require('os');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    // useUnifiedTopology: true
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get('/', isLoggedIn, (req, res) => {
    if (req.user.email) {
        res.redirect('/home');
    } else {
        // res.render('index');
        res.render('index');
    }
});
app.get('/home', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        const posts = await postModel.find()
            .populate('user', 'username'); // Fetch usernames
        res.render('home', { posts, user });
    } else {
        res.render('login');
    }
})
app.post('/create', async (req, res) => {
    const { email, username, name, password } = req.body;
    const alreadyCreated = await userModel.findOne({ email });
    const usernameTaken = await userModel.findOne({ username });
    if (alreadyCreated) {
        return res.status(400).json({ message: "User already exists" });
    }
    else if (usernameTaken) {
        return res.status(400).json({ message: "Username is taken, Ty choosing a different one" });
    }
    else {
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
                return res.status(200).json({ message: "User created" });
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

app.get('/create', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email }).populate('posts');
        const post = await postModel.find({ user: user._id });
        res.render('create', { user, post });
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
        res.redirect("/create");
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
        await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
        res.redirect("/create");
    } else {
        res.redirect('/login');
    }
});

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const post = await postModel.findById(req.params.id);
        await postModel.findByIdAndDelete(req.params.id);
        await userModel.updateOne(
            { _id: post.user },
            { $pull: { posts: req.params.id } } // Remove the post ID from the array
        );
        res.redirect("/create");
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

                await postModel.updateMany(
                    { "comments.commentUser": user._id }, // Find all posts with comments by this user
                    { $pull: { comments: { commentUser: user._id } } } // Remove those comments
                );
        
                await postModel.updateMany(
                    { likes: user._id}, // Find posts where user liked
                    { $pull: { likes: user._id} } // Remove user from likes array
                );
        

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

app.post("/updateusername", isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            res.status(400).json({ message: "User does not exist" });
        } else {
            if (user.username === req.body.username) {
                res.status(400).json({ message: "New username can not be same as old username" });
            } else {
                const alreadyExist = await userModel.findOne({ username: req.body.username });
                if (alreadyExist) {
                    res.status(400).json({ message: "This username is taken, choose a different one" });
                }
                else {
                    await userModel.findOneAndUpdate({ email: req.user.email }, { username: req.body.username });
                    res.status(200).json({ message: "Username updated" });
                }
            }
        }
    } else {
        res.redirect('/login');
    }
});

app.post("/updatename", isLoggedIn, async (req, res) => {
    if (req.user.email) {
        await userModel.findOneAndUpdate({ email: req.user.email }, { name: req.body.name });
        res.status(200).json({ message: "Name updated" });
    } else {
        res.redirect('/login');
    }
});

app.post('/like/:postId', async (req, res) => {
    const postId = req.params.postId;
    const userId = req.body.userId;
    const post = await postModel.findOne({ _id: postId });
    const likedIndex = post.likes.indexOf(userId);
    
    if (likedIndex === -1) {
        post.likes.push(userId); // Add like
        await post.save();
        res.status(200).json({ likes: post.likes.length, message: "liked" }); // Return updated like count
    } else {
        post.likes.splice(likedIndex, 1); // Remove like
        await post.save();
        res.status(200).json({ likes: post.likes.length, message: "unliked" }); // Return updated like count
    }
});

app.get('/comment/:postId', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const postId = req.params.postId;
        const user = await userModel.findOne({ email: req.user.email });
        const post = await postModel.findOne({ _id: postId });
        const postUser = await userModel.findOne({ _id: post.user });
        res.render('comment', { user, post, postUser })
    } else {
        res.redirect('/login');
    }
});

app.post('/comment/:postId', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const postId = req.params.postId;
        const post = await postModel.findOne({_id: postId});
        const {userId, content} = req.body;
        const user = await userModel.findOne({_id: userId});
        
        const comment = await postModel.findByIdAndUpdate(
            postId,
            {
                $push: {
                    comments: {
                        commentUsername: user.username,
                        commentUser: userId,
                        commentContent: content,
                        commentDate: new Date()
                    }
                }
            },
            { new: true }
        );
        res.status(200).json({message: "Comment published", comment });
    } else {
        res.redirect('/login');
    }
});

app.get('/delete/comment/:postId/:commentId', isLoggedIn, async (req, res) => {
    if (req.user.email) {
        const post = await postModel.findById(req.params.postId);
        post.comments = post.comments.filter(comment => comment._id.toString() !== req.params.commentId);
        await post.save();
        res.redirect(`/comment/${req.params.postId}`);
    } else {
        res.render('login');
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at port: http://localhost:${port}/`);
});