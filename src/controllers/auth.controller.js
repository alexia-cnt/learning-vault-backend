const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const generateToken = require("../utils/jwt");
const crypto = require("crypto");
const sendVerificationEmail = require("../utils/email");


exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número."
      });
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "El email ya se encuentra registrado" })
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");

    user.verificationToken = verificationToken;
    await user.save();

    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })

  } catch (error) {
    console.error("ERROR DE REGISTRO:", error);
    res.status(500).json({ message: "Error del servidor", error })
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: "Credenciales invalidas" })
    }

    if (!user.isVerified) {
      return res.status(401).json({ 
      message: "Debes verificar tu cuenta antes de iniciar sesión" })
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Credenciales invalidas" })
    }

    const token = generateToken(user._id);

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    res.status(500).json({ message: "Error del servidor", error })
  }
};


exports.verifyAccount = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token })

    if (!user) {
      return res.status(400).json({ message: "Token inválido o expirado" })
    }

    user.isVerified = true;
    user.verificationToken = undefined;

    await user.save();

    res.json({ message: "Cuenta verificada correctamente" })

  } 
  catch (error) {
    console.error("ERROR AL VERIFICAR:", error);
    res.status(500).json({ message: "Error del servidor" })
  }
};