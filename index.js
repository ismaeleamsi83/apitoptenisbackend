const express = require('express');
const multer = require('multer');
const cors = require('cors');
const app = express();
const port = 3000;
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Configuración de multer (almacenamiento en memoria o en disco)
// const storage = multer.memoryStorage(); // Almacenar el archivo en memoria
// const upload = multer({ storage: storage });

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type'], 
}
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

const uri = "mongodb+srv://ismaelreyplata:69n6IoJDgadmygpW@cluster0.h3jua.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function main() {
    try {
        await client.connect();
        console.log("Conectado a MongoDB correctamente");
    } catch (e) {
        console.error(e);
        process.exit(1);  // Si no puede conectarse, cierra la aplicación
    }
}

main(); 

app.get("/", (req, res) => {
  res.send("Arranca la app en node");
});

app.get("/players", async (req, res) => {
    try{
        const db = client.db("toptenisquedadas");
        const col = db.collection("listusers");
        const players = await col.find().toArray();
        res.status(200).send({message: "players recibidos", players: players});
    }catch(err){
        console.log(err);
    }
    
});

app.post('/register', async (req, res) =>{
    
    const { password } = req.body;
    const hashedPassword = await encrypt(password);
    const newListing = req.body;
    newListing.password = hashedPassword;

    try{
        await createListing(client, newListing);
        res.status(201).send({message: 'Listing creado con exito'});
    }catch(e){
        if(e.code === 11000){
            res.status(400).send({message: 'El usuario ya existe'});
        }else{
            res.status(500).send({message: 'Error al crear el usuario'});
        }
    }
})
app.listen(port, () => {
  console.log("Api escuchando en la url http://localhost:3000");
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try{
        const db = client.db("toptenisquedadas");
        const col = db.collection("listusers");
        
        const filter = { "email": email };
        const user = await col.findOne(filter);
        console.log("encuentra el usuario");
        if(user){
            try{
                console.log("antes de mirar el password");
                const okPass = await compare(password, user.password);
                if(okPass){
                    console.log("password correcto");
                    const token = jwt.sign({
                        email
                      }, 'secret', { expiresIn: '1h' });
                    res.status(200).send({message: 'Login exitoso', token: token});
                    
                    
                }else{
                    res.status(401).send({message: 'Contraseña incorrecta'});
                }
            }catch(err){
                res.status(500).send({message: 'Error al loguearse'});
            }  
        }else{
            res.status(404).send({message: 'Usuario no encontrado'});
        }
        
    }catch(e){
        res.status(500).send({message: 'Error de login'});
    }
});

app.post('/profile', async (req, res)=>{
    const { email, token } = req.body;
    console.log(email);
    console.log(token);
    try {
        const decoded = jwt.verify(token, 'secret');
        console.log(decoded);
        try{
            const db = client.db("toptenisquedadas");
            const col = db.collection("listusers");
            
            const filter = { "email": email };
            const user = await col.findOne(filter);
            if(user){
                if (user.imageUrl && user.imageUrl._bsontype === 'Binary') {
                    user.imageUrl = user.imageUrl.toString('base64'); // Convertir a Base64
                } else {
                    user.imageUrl = null; // Si no tiene imagen, devuelve null o un valor predeterminado
                }
        
                // Eliminar campos sensibles antes de enviar al frontend (si es necesario)
                
                // console.log(user);
                return res.status(200).send({message: "Perfil de usuario recibido", user: user});
            }else{
                return res.status(404).send({message: 'Usuario no encontrado'});
            }
        }catch(e){
            return res.status(500).send({message: 'Error al obtener perfil'});
        }
    } catch(err) {
        console.log("errrorrrrr de verificacion de token");
        return res.status(402).send({message: "Error al verificar el token"});
    }
    return res.status(200).send({message: "Ok profile"});
});



app.put('/update-profile', async (req ,res) => {
    const { token, email, name, lastname, preference, level, matchesPlayed, matchesWon, 
        about, availability, sex, birthday, population, password, _id } = req.body;
    console.log(_id);

    // Crea un objeto para actualizar
    const updateUser = { email, name, lastname, preference, level, matchesPlayed, 
        matchesWon, about, availability, sex, birthday, population, password }; 

    const user = req.body;
    if (user.imageUrl) {
        // El archivo está en base64, lo convertimos a Buffer
        const buffer = Buffer.from(user.imageUrl, 'base64');
        
        // Aquí podrías guardar el buffer en la base de datos, por ejemplo, en GridFS o MongoDB
        console.log('Archivo recibido como buffer:', buffer);

        updateUser.imageUrl = buffer;
    }

    

    
    
    
    

    try {
        const decoded = jwt.verify(token, 'secret');
        console.log(decoded);

        try{
            const result = await client.db("toptenisquedadas").collection("listusers").updateOne(
                { _id: new ObjectId(_id) }, // Filtro: busca el documento por _id
                { $set: updateUser } // Actualiza el documento con los datos de updateUser
            );
    
            if (result.matchedCount === 0) {
                console.log(`No se encontró ningún documento con el ID`);
                return req.status(402).send({message: "No se encontro el documento"}); // No se encontró el documento
            }
            console.log(`Documento actualizado con el ID:`);
            return res.status(200).send({message: "Profile actualizado", user: updateUser});
        }catch(error){
            console.error("Error al actualizar el perfil:", error);
            return res.status(500).send({message: 'Error al actualizar el perfil'});
        }
        

        return res.status(200).send({message: "Ok update"});
    }catch(err){
        return res.status(402).send({message: "Error al verificar el token"});
    }
})





// Crear una nueva lista
async function createListing(client, newListing){
    // Asegurarte de que el índice para el campo 'email' sea único
    await client.db("toptenisquedadas").collection("listusers").createIndex({ email: 1 }, { unique: true });
    const result = await client.db("toptenisquedadas").collection("listusers").insertOne(newListing);
    console.log(`New listing created with the following id: ${result.insertedId}`);
}



//Encriptar
const encrypt = async (textPlain) => {
    const hash = await bcrypt.hash(textPlain, 10);
    return hash;
}

//Compare
const compare = async (textPlain, hash) => {
    const result = await bcrypt.compare(textPlain, hash);
    return result;
}

