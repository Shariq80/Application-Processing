require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const name = await question('Enter user name: ');
    const email = await question('Enter user email: ');
    const password = await question('Enter user password: ');

    const user = new User({
      name,
      email,
      password,
      role: 'user'
    });

    await user.save();
    console.log('User created successfully!');
    
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
}

createUser();
