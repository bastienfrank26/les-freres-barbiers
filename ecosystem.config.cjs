module.exports = {
  apps: [
    {
      name: "Les freres Barbiers",
      script: "serve",
      env: {
        PM2_SERVE_PATH: "./dist",
        PM2_SERVE_PORT: 3001,
        PM2_SERVE_SPA: "true",
        NODE_ENV: "production"
      }
    }
  ]
};
