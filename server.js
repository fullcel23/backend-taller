const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'taller_secreto_2024';

// ============ MODELOS ============
const UsuarioSchema = new mongoose.Schema({
  nombre: String,
  email: { type: String, unique: true },
  password: String,
  rol: String,
  activo: { type: Boolean, default: true },
  fechaExpiracion: Date
});

UsuarioSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  bcrypt.genSalt(10, (err, salt) => {
    if (err) return next(err);
    bcrypt.hash(this.password, salt, (err, hash) => {
      if (err) return next(err);
      this.password = hash;
      next();
    });
  });
});

UsuarioSchema.methods.compararPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const Usuario = mongoose.model('Usuario', UsuarioSchema);

const TrabajoSchema = new mongoose.Schema({
  cliente: String,
  telefono: String,
  equipo: String,
  modelo: String,
  falla: String,
  password: String,
  precio: Number,
  estado: String,
  fechaIngreso: { type: Date, default: Date.now }
});

const Trabajo = mongoose.model('Trabajo', TrabajoSchema);

const ProductoSchema = new mongoose.Schema({
  nombre: String,
  precio: Number,
  costo: Number,
  cantidad: Number,
  categoria: String,
  stockMinimo: { type: Number, default: 5 }
});

const Producto = mongoose.model('Producto', ProductoSchema);

// ============ RUTAS ============

// Login
app.post('/api/usuarios/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    
    const valido = await usuario.compararPassword(password);
    if (!valido) return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    
    const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, JWT_SECRET);
    res.json({ success: true, data: { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, token } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trabajos
app.post('/api/trabajos', async (req, res) => {
  try {
    const trabajo = new Trabajo(req.body);
    await trabajo.save();
    res.json({ success: true, data: trabajo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/trabajos', async (req, res) => {
  try {
    const trabajos = await Trabajo.find().sort({ fechaIngreso: -1 });
    res.json({ success: true, data: trabajos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Productos
app.post('/api/productos', async (req, res) => {
  try {
    const producto = new Producto(req.body);
    await producto.save();
    res.json({ success: true, data: producto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await Producto.find();
    res.json({ success: true, data: productos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/productos/:id/stock', async (req, res) => {
  try {
    const { cantidad, operacion } = req.body;
    const producto = await Producto.findById(req.params.id);
    if (operacion === 'sumar') producto.cantidad += cantidad;
    else producto.cantidad -= cantidad;
    await producto.save();
    res.json({ success: true, data: producto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente!' });
});

// Conectar a MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Conectado a MongoDB Atlas'))
    .catch(err => console.log('❌ Error:', err.message));
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});