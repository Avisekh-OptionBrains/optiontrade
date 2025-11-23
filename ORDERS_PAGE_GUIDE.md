# 📋 Orders Page - User Guide

## 🎯 Overview

The Orders Page is a comprehensive interface for viewing and managing all trading orders in the Epicrise Trading Platform. It provides real-time order tracking, advanced filtering, and export capabilities.

---

## 🚀 Accessing the Orders Page

### **URL:**
```
http://localhost:3000/orders.html
```

### **Navigation:**
1. From the main dashboard, click **"Orders"** in the sidebar
2. Or click **"View All Orders"** in the Quick Actions section

---

## 📊 Features

### **1. Real-Time Statistics**

Four key metrics displayed at the top:
- **Total Orders** - Total number of orders in the selected period
- **Successful** - Orders executed successfully
- **Failed** - Orders that failed to execute
- **Pending** - Orders awaiting execution

### **2. Advanced Filters**

Filter orders by:
- **Broker** - IIFL, Angel, Motilal, Dhan, ShareKhan
- **Status** - Success, Failed, Pending
- **Date Range** - Start date and end date
- **Client Name** - Search by client name
- **Symbol** - Search by trading symbol (e.g., BANKNIFTY, NIFTY)

### **3. Orders Table**

Displays comprehensive order information:
- **Time** - Order timestamp
- **Client** - Client name
- **Broker** - Broker used for the order
- **Symbol** - Trading symbol
- **Type** - BUY or SELL
- **Order Type** - MARKET, LIMIT, STOPLOSS, etc.
- **Quantity** - Number of shares/contracts
- **Price** - Order price
- **Status** - Order status with color coding
- **Order ID** - Unique order identifier
- **Message** - Additional order information

### **4. Pagination**

- Navigate through large datasets
- 50 orders per page
- Previous/Next buttons
- Page counter and total records display

### **5. Export to CSV**

- Export filtered orders to CSV format
- Includes all order details
- Filename: `orders_YYYY-MM-DD.csv`

---

## 🎨 User Interface

### **Color Coding:**

**Status Badges:**
- 🟢 **Green** - SUCCESS
- 🔴 **Red** - FAILED
- 🟡 **Yellow** - PENDING

**Transaction Type:**
- 🟢 **Green Badge** - BUY
- 🔴 **Red Badge** - SELL

**Broker Badges:**
- 🔵 **Blue Badge** - All brokers

---

## 📖 How to Use

### **View Today's Orders**

1. Open the orders page
2. Default view shows today's orders
3. Statistics update automatically

### **Filter Orders**

1. Select desired filters:
   - Choose broker from dropdown
   - Select status
   - Set date range
   - Enter client name or symbol
2. Click **"Apply Filters"**
3. Results update immediately

### **Reset Filters**

1. Click **"Reset"** button
2. All filters clear
3. Returns to today's orders

### **Export Orders**

1. Apply desired filters (optional)
2. Click **"Export CSV"** button
3. CSV file downloads automatically
4. Open in Excel or any spreadsheet application

### **Refresh Data**

1. Click **"Refresh"** button (top right of table)
2. Reloads current page with latest data

### **Navigate Pages**

1. Use **"Previous"** and **"Next"** buttons
2. View page number and total pages
3. See total records count

---

## 🔧 Technical Details

### **API Endpoints Used:**

1. **Get Orders:**
   ```
   GET /api/enhanced-dashboard/orders
   ```
   Query Parameters:
   - `page` - Page number
   - `limit` - Records per page (default: 50)
   - `broker` - Filter by broker
   - `status` - Filter by status
   - `startDate` - Start date
   - `endDate` - End date
   - `clientName` - Client name search
   - `symbol` - Symbol search

2. **Get Statistics:**
   ```
   GET /api/order-responses
   ```
   Returns all orders for statistics calculation

3. **Export Orders:**
   ```
   GET /api/enhanced-dashboard/export?format=csv
   ```
   Downloads CSV file

### **Files:**

- **HTML:** `public/orders.html`
- **JavaScript:** `public/orders.js`
- **Styles:** `public/dashboard-styles.css`

---

## 📱 Responsive Design

The orders page is fully responsive and works on:
- 💻 Desktop computers
- 📱 Tablets
- 📱 Mobile phones

---

## 🎯 Best Practices

1. **Use Date Filters** - Narrow down results for faster loading
2. **Export Regularly** - Keep CSV backups of important orders
3. **Check Statistics** - Monitor success/failure rates
4. **Refresh Often** - Keep data up-to-date during trading hours
5. **Use Specific Filters** - Combine multiple filters for precise results

---

## 🔍 Example Use Cases

### **1. View All IIFL Orders Today**
- Set Start Date: Today
- Set End Date: Today
- Broker: IIFL
- Click "Apply Filters"

### **2. Find Failed Orders for a Client**
- Status: FAILED
- Client Name: Enter client name
- Click "Apply Filters"

### **3. Export BANKNIFTY Orders**
- Symbol: BANKNIFTY
- Set date range
- Click "Apply Filters"
- Click "Export CSV"

### **4. Monitor Real-Time Success Rate**
- Keep page open
- Click "Refresh" periodically
- Watch statistics update

---

## 🚨 Troubleshooting

### **No Orders Showing**
- Check date range (default is today only)
- Verify filters are not too restrictive
- Click "Reset" to clear all filters

### **Export Not Working**
- Check browser download settings
- Ensure pop-ups are not blocked
- Try different browser

### **Slow Loading**
- Reduce date range
- Apply more specific filters
- Check internet connection

---

## 🔗 Related Pages

- **Main Dashboard** - `/` - Overview and quick stats
- **Subscription Manager** - `/subscription-manager.html` - Manage user subscriptions
- **Enhanced Dashboard** - `/enhanced-dashboard.html` - Advanced analytics

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review API documentation
3. Contact system administrator

---

## ✨ Future Enhancements

Planned features:
- Real-time order updates via WebSocket
- Advanced search with multiple criteria
- Order details modal/popup
- Bulk order actions
- Custom date presets (Last 7 days, Last 30 days, etc.)
- Order status change tracking
- Performance metrics and charts

---

**Last Updated:** 2025-11-13  
**Version:** 1.0

