import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { MongoClient } from 'mongodb';

let client = null;

async function getMongoClient(uri) {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

// Custom Vite plugin to handle MongoDB Auth requests
function mongodbAuthPlugin(uri) {
  return {
    name: 'mongodb-auth-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        if (url.pathname === '/api/auth/signup' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { name, email, password } = await getBody(req);
            if (!name || !email || !password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing required fields" }));
              return;
            }

            const mongoClient = await getMongoClient(uri);
            const db = mongoClient.db('algodocs_db');
            const usersCollection = db.collection('users');

            const existingUser = await usersCollection.findOne({ email });
            if (existingUser) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "User already exists (duplicate key)" }));
              return;
            }

            const newUser = { name, email, password, createdAt: new Date() };
            const result = await usersCollection.insertOne(newUser);

            res.statusCode = 200;
            res.end(JSON.stringify({
              status: "success",
              message: "User registered in MongoDB Atlas",
              user: { name, email },
              result
            }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
          }
          return;
        }

        if (url.pathname === '/api/auth/login' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { email, password } = await getBody(req);
            if (!email || !password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing email or password" }));
              return;
            }

            const mongoClient = await getMongoClient(uri);
            const db = mongoClient.db('algodocs_db');
            const usersCollection = db.collection('users');

            const user = await usersCollection.findOne({ email, password });
            if (!user) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid email or password" }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({
              status: "success",
              message: "User authenticated",
              user: { name: user.name, email: user.email }
            }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
          }
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables in Vite dev server process
  const env = loadEnv(mode, process.cwd(), '');
  const mongoUri = env.MONGODB_URI;

  return {
    plugins: [react(), mongodbAuthPlugin(mongoUri)],
  };
});
