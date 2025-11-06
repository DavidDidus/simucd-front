import express from "express";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  "/api",
  createProxyMiddleware({
    target: "http://simucd-back:8000",
    changeOrigin: true,
    pathRewrite: { "^/api": "" } // mantiene /api en la ruta
  })
);
app.use(express.static(path.join(__dirname, "dist")));

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Frontend + proxy escuchando en puerto ${PORT}`);
  console.log(`➡️  Redirigiendo /api → http://simucd-back:8000`);
});
