const express = require('express');
const fs = require('fs');
const path = require('path');

// Mock dependencies to avoid crashes
global.DOMMatrix = class {};
global.ImageData = class {};
global.Path2D = class {};

// We need to bypass the actual listen/initDB calls to just see the routes
const serverFile = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const modifiedServer = serverFile
  .replace(/app\.listen\([\s\S]*?\);/g, '')
  .replace(/initDB\(\);/g, '')
  .replace(/pool\.query\([\s\S]*?\);/g, 'Promise.resolve()');

try {
    // This is a bit hackerish but will let us see the app object
    const module = { exports: {} };
    const req = (n) => {
        if (n === 'express') return express;
        if (n === 'cors') return () => (req, res, next) => next();
        if (n === 'multer') return () => ({ array: () => (req, res, next) => next(), diskStorage: () => ({}) });
        if (n === 'pg') return { Pool: function() { return { query: () => Promise.resolve({ rows: [] }) }; } };
        return {};
    };
    
    // Actually, let's just grep for the specific strings in server.js
    console.log("Checking server.js for route definitions...");
    const routes = serverFile.match(/app\.(get|post|put|delete|use)\(['"](.*?)['"]/g);
    if (routes) {
        routes.forEach(r => console.log(r));
    } else {
        console.log("No routes found using regex match.");
    }
} catch (e) {
    console.error(e);
}
