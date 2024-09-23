const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type'], 
}
app.use(cors(corsOptions));
app.use(express.json());

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

        if(user){
            try{
                const okPass = await compare(password, user.password);
                if(okPass){
                    res.status(200).send({message: 'Login exitoso'});
                }else{
                    res.status(401).send({message: 'Contraseña incorrecta'});
                }
            }catch(err){
                res.status(500).send({message: 'No esta bien la contraseña'});
            }  
        }else{
            res.status(404).send({message: 'Usuario no encontrado'});
        }
        
    }catch(e){
        res.status(500).send({message: 'Error de login'});
    }
});


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

