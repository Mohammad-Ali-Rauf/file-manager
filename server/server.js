import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import multer from 'multer';
import Grid from 'gridfs-stream';
import { config } from 'dotenv';
config();

const app = express();

app.use(express.json());

// Connect to the database
try {
  mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB');
} catch (err) {
  console.error('Error connecting to MongoDB: ', err);
}

const connection = mongoose.connection;
let gfs; // GridFS stream instance

connection.once('open', () => {
  // Initialize GridFS stream using the connection and mongoose.mongo
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection('files'); // Set the collection name for file uploads
});

// Set up GridFS storage
const storage = multer({
  storage: multer.GridFsStorage({
    gfs,
    file: (req, file) => {
      return { filename: file.originalname };
    },
  }),
});

// File upload route handler
app.post('/upload', storage.single('file'), (req, res) => {
  // Access the uploaded file information via req.file
  // Perform any additional processing or database operations here
  // Return appropriate response to the client
});

// Get a specific file by its ID
app.get('/files/:id', (req, res) => {
  gfs.files.findOne({ _id: req.params.id }, (err, file) => {
    if (err) {
      return res.status(500).json({ error: 'Error retrieving the file' });
    }
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ file });
  });
});

// Delete a file by its ID
app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(500).json({ error: 'Error deleting the file' });
    }
    res.json({ message: 'File deleted successfully' });
  });
});

const PORT = 5000 || process.env.PORT;

app.get('/', (req, res) => res.send(`Server is running perfectly`));

app.post('/register', async (req, res) => {
  const { name, email, password, createdAt } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    name,
    email,
    password: hashedPassword,
    createdAt,
  });

  await newUser.save();

  const token = jwt.sign(
    {
      userId: newUser._id,
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      createdAt: newUser.createdAt,
    },
    process.env.JWT_SECRET
  );

  return res.status(201).json({
    msg: 'User registered successfully!!',
    user: newUser,
    token: token,
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email in the database
    const user = await User.findOne({ email });

    // Check if the user exists
    if (!user) {
      return res.status(400).json({ msg: 'User doesn\'t exists!!' });
    }

    // Compare the provided password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If the password is not valid, return an error
    if (!isPasswordValid) {
      return res.status(400).json({ msg: 'Invalid email or password' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        email: user.email,
        password: user.password,
        createdAt: user.createdAt,
      },
      process.env.JWT_SECRET
    );

    // Return a success response with the user and token
    return res
      .status(200)
      .json({ msg: 'User logged in successfully!', user, token });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
