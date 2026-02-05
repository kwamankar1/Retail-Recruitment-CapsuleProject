require('dotenv').config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./config/db");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET || "capsule-secret-change-this-in-production",
  resave: false,
  saveUninitialized: true,
  cookie: { 
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 1800000,
    secure: process.env.SECURE_COOKIES === 'true'
  }
}));

// Middleware for authentication
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Middleware for admin only
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).send("Access denied. Admin privileges required.");
  }
}

// Activity logging function
async function logActivity(userId, activityType, description) {
  try {
    await db.execute(
      "INSERT INTO user_activity (user_id, activity_type, activity_description) VALUES (?, ?, ?)",
      [userId, activityType, description]
    );
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// Public routes (no authentication required)
app.get("/", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect("/admin-dashboard");
    } else {
      res.redirect("/dashboard");
    }
  } else {
    res.sendFile(path.join(__dirname, "public/html/index.html"));
  }
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin-dashboard' : '/dashboard');
  } else {
    res.sendFile(path.join(__dirname, "public/html/login.html"));
  }
});

app.get("/register", (req, res) => {
  if (req.session.user) {
    res.redirect(req.session.user.role === 'admin' ? '/admin-dashboard' : '/dashboard');
  } else {
    res.sendFile(path.join(__dirname, "public/html/register.html"));
  }
});

app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "public/html/contact.html")));

// Protected routes for regular users
app.get("/dashboard", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public/html/dashboard.html")));
app.get("/inventory", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public/html/inventory.html")));
app.get("/chatbot", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public/html/chatbot.html")));
app.get("/trends", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public/html/trends.html")));
app.get("/notifications", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public/html/notifications.html")));

// Admin-only routes
app.get("/admin-dashboard", requireAdmin, (req, res) => res.sendFile(path.join(__dirname, "public/html/admin-dashboard.html")));
app.get("/admin-users", requireAdmin, (req, res) => res.sendFile(path.join(__dirname, "public/html/admin-users.html")));

// Legacy redirects
app.get("/index", (req, res) => res.redirect("/dashboard"));


// Redirect .html requests
app.get("/register.html", (req, res) => res.redirect("/register"));
app.get("/login.html", (req, res) => res.redirect("/login"));
app.get("/index.html", (req, res) => res.redirect("/index"));
app.get("/inventory.html", (req, res) => res.redirect("/inventory"));
app.get("/chatbot.html", (req, res) => res.redirect("/chatbot"));
app.get("/trends.html", (req, res) => res.redirect("/trends"));
app.get("/notifications.html", (req, res) => res.redirect("/notifications"));
app.get("/contact.html", (req, res) => res.redirect("/contact"));

// Registration route
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if username already exists
    const [existingUser] = await db.execute("SELECT id FROM users WHERE username = ?", [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }
    
    // Insert new user
    const [result] = await db.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
      [username, email, password]
    );
    
    // Log registration activity
    await logActivity(result.insertId, 'REGISTRATION', `User ${username} registered`);
    
    // Return success response for AJAX calls
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      res.json({ success: true, message: "Registration successful" });
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: "Username or email already exists" });
    } else {
      res.status(500).json({ success: false, message: "Server error during registration" });
    }
  }
});

// Login route with enhanced authentication and logging
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE username=? AND password=?", [username, password]);
    if (rows.length > 0) {
      const user = rows[0];
      req.session.user = user;
      
      // Update last login time
      await db.execute("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);
      
      // Log login activity
      await logActivity(user.id, 'LOGIN', `User ${username} logged in`);
      
      // Redirect based on role
      if (user.role === 'admin') {
        res.json({ success: true, redirect: '/admin-dashboard', role: 'admin' });
      } else {
        res.json({ success: true, redirect: '/dashboard', role: 'user' });
      }
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: "Server error" });
  }
});

// Add inventory item
app.post("/inventory", async (req, res) => {
  const { name, quantity, price, category, supplier } = req.body;
  await db.execute(
    "INSERT INTO inventory (name, quantity, price, category, supplier) VALUES (?, ?, ?, ?, ?)",
    [name, quantity, price, category, supplier]
  );
  res.sendStatus(200);
});

// Get all inventory items
app.get("/inventory-data", async (req, res) => {
  const [rows] = await db.execute("SELECT * FROM inventory");
  res.json(rows);
});

// Delete inventory item by ID
app.delete("/inventory/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute("DELETE FROM inventory WHERE id = ?", [id]);
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Item not found" });
    }
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Chatbot backend logic
app.post("/chatbot", async (req, res) => {
  const { message } = req.body;
  const lower = message.toLowerCase();

  try {
    // Greeting handler
    if (/^(hi|hello|hey|good morning|good evening)/i.test(lower)) {
      return res.json({
        reply: "Hello! Welcome to the Retail Assistant. How may I help you today?",
      });
    }

    if (lower.includes("low stock")) {
      const lowThreshold = process.env.LOW_STOCK_THRESHOLD || 5;
      const [rows] = await db.execute("SELECT * FROM inventory WHERE quantity < ?", [lowThreshold]);
      const reply = rows.length
        ? `Low stock items: ${rows.map(r => `${r.name} (${r.quantity})`).join(", ")}`
        : "No items are currently low in stock.";
      return res.json({ reply });
    }

    if (lower.includes("high stock")) {
      const highThreshold = process.env.HIGH_STOCK_THRESHOLD || 15;
      const [rows] = await db.execute("SELECT * FROM inventory WHERE quantity > ?", [highThreshold]);
      const reply = rows.length
        ? `High stock items: ${rows.map(r => `${r.name} (${r.quantity})`).join(", ")}`
        : "No items are currently high in stock.";
      return res.json({ reply });
    }

    if (lower.includes("items do we have") || lower.includes("all items")) {
      const [rows] = await db.execute("SELECT name FROM inventory");
      const reply = rows.length
        ? `We have: ${rows.map(r => r.name).join(", ")}`
        : "No items found in inventory.";
      return res.json({ reply });
    }

    if (lower.includes("suppliers")) {
      const [rows] = await db.execute("SELECT DISTINCT supplier FROM inventory");
      const reply = rows.length
        ? `Suppliers: ${rows.map(r => r.supplier).join(", ")}`
        : "No suppliers found.";
      return res.json({ reply });
    }

    if (lower.includes("categories") || lower.includes("category")) {
      const [rows] = await db.execute("SELECT DISTINCT category FROM inventory");
      const reply = rows.length
        ? `Categories: ${rows.map(r => r.category).join(", ")}`
        : "No categories found.";
      return res.json({ reply });
    }

    if (lower.includes("item with id") || lower.includes("id")) {
      const idMatch = lower.match(/(\d+)/);
      if (idMatch) {
        const id = parseInt(idMatch[1]);
        const [rows] = await db.execute("SELECT * FROM inventory WHERE id = ?", [id]);
        const reply = rows.length
          ? `Item ID ${id}: ${rows[0].name}, Quantity: ${rows[0].quantity}, Price: ${rows[0].price}, Supplier: ${rows[0].supplier}, Category: ${rows[0].category}`
          : `No item found with ID ${id}.`;
        return res.json({ reply });
      }
    }

    return res.json({
      reply: "I'm sorry, I didn't understand that. Please try asking about stock, items, suppliers, or item by ID.",
    });
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ reply: "An error occurred while processing your request." });
  }
});

// Notifications data endpoint for notifications.html
app.get("/notifications-data", async (req, res) => {
  try {
    const [lowStock] = await db.execute("SELECT * FROM inventory WHERE quantity < 5");
    const [highStock] = await db.execute("SELECT * FROM inventory WHERE quantity > 15");
    const [suppliers] = await db.execute("SELECT DISTINCT supplier FROM inventory");
    const [categories] = await db.execute("SELECT DISTINCT category FROM inventory");
    res.json({
      lowStock,
      highStock,
      suppliers: suppliers.map(r => r.supplier),
      categories: categories.map(r => r.category)
    });
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Contact support email route
app.post("/contact-support", async (req, res) => {
  const { username, email, issue, message } = req.body;
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: email,
      to: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER,
      subject: `Support Request: ${issue}`,
      text: `Username: ${username}\nEmail: ${email}\nIssue: ${issue}\nMessage: ${message}`
    });
    res.sendStatus(200);
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).send("Failed to send email");
  }
});

// Admin API endpoints
app.get("/api/admin/dashboard-stats", requireAdmin, async (req, res) => {
  try {
    console.log('Admin dashboard stats requested by:', req.session.user?.username);
    
    // Get user statistics
    const [userCount] = await db.execute("SELECT COUNT(*) as total FROM users WHERE role != 'admin'");
    const [recentUsers] = await db.execute("SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND role != 'admin'");
    const [activeUsers] = await db.execute("SELECT COUNT(*) as count FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND role != 'admin'");
    
    console.log('User stats:', { userCount: userCount[0], recentUsers: recentUsers[0], activeUsers: activeUsers[0] });
    
    // Get inventory statistics
    const [inventoryCount] = await db.execute("SELECT COUNT(*) as total FROM inventory");
    const [lowStock] = await db.execute("SELECT COUNT(*) as count FROM inventory WHERE quantity < 5");
    const [totalValue] = await db.execute("SELECT SUM(quantity * price) as value FROM inventory");
    
    console.log('Inventory stats:', { inventoryCount: inventoryCount[0], lowStock: lowStock[0], totalValue: totalValue[0] });
    
    // Get recent activity
    const [recentActivity] = await db.execute(`
      SELECT ua.*, u.username 
      FROM user_activity ua 
      JOIN users u ON ua.user_id = u.id 
      ORDER BY ua.created_at DESC 
      LIMIT 10
    `);
    
    console.log('Recent activity count:', recentActivity.length);
    
    // Get login statistics
    const [todayLogins] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM user_activity 
      WHERE activity_type = 'LOGIN' 
      AND DATE(created_at) = CURDATE()
    `);
    
    const [weeklyLogins] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM user_activity 
      WHERE activity_type = 'LOGIN' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    console.log('Login stats:', { todayLogins: todayLogins[0], weeklyLogins: weeklyLogins[0] });
    
    const responseData = {
      users: {
        total: userCount[0].total,
        recent: recentUsers[0].count,
        active: activeUsers[0].count
      },
      inventory: {
        total: inventoryCount[0].total,
        lowStock: lowStock[0].count,
        totalValue: totalValue[0].value || 0
      },
      activity: recentActivity,
      logins: {
        today: todayLogins[0].count,
        week: weeklyLogins[0].count
      }
    };
    
    console.log('Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT id, username, email, role, created_at, last_login 
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get("/api/admin/user-activity", requireAdmin, async (req, res) => {
  try {
    const [activity] = await db.execute(`
      SELECT ua.*, u.username 
      FROM user_activity ua 
      JOIN users u ON ua.user_id = u.id 
      ORDER BY ua.created_at DESC 
      LIMIT 50
    `);
    res.json(activity);
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get("/api/admin/inventory-logs", requireAdmin, async (req, res) => {
  try {
    const [logs] = await db.execute(`
      SELECT il.*, u.username, i.name as item_name 
      FROM inventory_logs il 
      JOIN users u ON il.user_id = u.id 
      LEFT JOIN inventory i ON il.inventory_id = i.id 
      ORDER BY il.created_at DESC 
      LIMIT 50
    `);
    res.json(logs);
  } catch (error) {
    console.error('Get inventory logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Enhanced inventory routes with activity logging
app.post("/inventory", requireAuth, async (req, res) => {
  const { name, quantity, price, category, supplier } = req.body;
  try {
    const [result] = await db.execute(
      "INSERT INTO inventory (name, quantity, price, category, supplier) VALUES (?, ?, ?, ?, ?)",
      [name, quantity, price, category, supplier]
    );
    
    // Log inventory addition
    if (req.session.user) {
      await logActivity(req.session.user.id, 'INVENTORY_ADD', `Added item: ${name} (Qty: ${quantity})`);
    }
    
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Add inventory error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/inventory/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // Get item details before deletion for logging
    const [item] = await db.execute("SELECT * FROM inventory WHERE id = ?", [id]);
    
    const [result] = await db.execute("DELETE FROM inventory WHERE id = ?", [id]);
    if (result.affectedRows > 0) {
      // Log inventory deletion
      if (req.session.user && item.length > 0) {
        await logActivity(req.session.user.id, 'INVENTORY_DELETE', `Deleted item: ${item[0].name}`);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Item not found" });
    }
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// User session info endpoint
app.get("/api/user-info", requireAuth, (req, res) => {
  const { password, ...userInfo } = req.session.user;
  res.json(userInfo);
});

// Health check endpoint for Docker
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// Logout route
app.post("/logout", (req, res) => {
  if (req.session.user) {
    logActivity(req.session.user.id, 'LOGOUT', `User ${req.session.user.username} logged out`);
  }
  req.session.destroy(() => {
    res.json({ success: true });
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
// trigger build Thu, Feb  5, 2026 11:20:08 AM
// trigger build Thu, Feb  5, 2026 11:28:28 AM
