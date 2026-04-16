const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'mi_secreto_2024';

// ============================================
// MODELOS
// ============================================

const UsuarioSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  password: String,
  rol: String,
  activo: { type: Boolean, default: true }
});

UsuarioSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) return next(err);
    this.password = hash;
    next();
  });
});

UsuarioSchema.methods.compararPassword = function(password, cb) {
  bcrypt.compare(password, this.password, cb);
};

const Usuario = mongoose.model('Usuario', UsuarioSchema);

const Trabajo = mongoose.model('Trabajo', new mongoose.Schema({
  cliente: String, telefono: String, equipo: String, modelo: String,
  falla: String, password: String, precio: Number, estado: String,
  fechaIngreso: { type: Date, default: Date.now }
}));

const Producto = mongoose.model('Producto', new mongoose.Schema({
  nombre: String, precio: Number, costo: Number, cantidad: Number, categoria: String
}));

// ============================================
// FUNCIÓN PARA CREAR ADMIN AUTOMÁTICAMENTE
// ============================================

async function crearAdminSiNoExiste() {
  try {
    const adminExists = await Usuario.findOne({ email: 'admin@taller.com' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = new Usuario({
        nombre: 'Administrador',
        email: 'admin@taller.com',
        password: hashedPassword,
        rol: 'admin',
        activo: true
      });
      await admin.save();
      console.log('✅ Administrador creado automáticamente');
      console.log('📧 Email: admin@taller.com');
      console.log('🔑 Contraseña: admin123');
    } else {
      console.log('✅ Administrador ya existe');
    }
  } catch (error) {
    console.error('❌ Error al crear admin:', error.message);
  }
}

// ============================================
// RUTAS
// ============================================

app.post('/api/usuarios/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    
    usuario.compararPassword(password, (err, valido) => {
      if (err || !valido) {
        return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
      }
      const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, JWT_SECRET);
      res.json({
        success: true,
        data: {
          _id: usuario._id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          token
        }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

app.put('/api/trabajos/:id', async (req, res) => {
  try {
    const trabajo = await Trabajo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: trabajo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/trabajos/:id', async (req, res) => {
  try {
    await Trabajo.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

app.get('/api/test', (req, res) => {
  res.json({ mensaje: '✅ Backend funcionando!' });
});

// ============================================
// CONEXIÓN A MONGODB Y INICIO
// ============================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI no está configurada');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB Atlas');
    await crearAdminSiNoExiste(); // 👈 Esto crea el admin automáticamente
  })
  .catch(err => console.error('❌ Error de conexión:', err.message));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});