const fs = require('fs');
const https = require('https');
const axios = require('axios');
const mysql = require('mysql2/promise');
const { Address4 } = require('ip-address');

const dbConfig = {
    host: "localhost",
    user: "nicola",
    password: "Agrintesa2025",
    database: "printers",
  };

const saveDir = "scanhtml"
// Connect to the MySQL database
async function getIPs() {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute("SELECT ip, mask FROM ip as a inner join subnet as b on a.subnet = b.id WHERE snmp = false order by inet_aton(ip)");
    await connection.end();
    return rows;
}

// Function to get subnet from IP address and mask
function getSubnet(ip, mask) {
    const address = new Address4(`${ip}/${mask}`);
    return address.startAddress().address.split('.').slice(0, 3).join('.');
}

// Function to make HTTP/HTTPS requests and save responses
async function fetchAndSave(ipAddress, mask) {
    let subnet = getSubnet(ipAddress, mask);
    let url = `http://${ipAddress}`;

    try {
        let response = await axios.get(url, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        saveResponse(subnet, ipAddress, response.data);
        console.log(`Saved ${ipAddress}.html`)
    } catch (error) {
        try {
            let response = await axios.get(`https://${ipAddress}`, {
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            });
            saveResponse(subnet, ipAddress, response.data);
            console.log(`Saved ${ipAddress}.html`)
        } catch (error) {
            console.log(`Failed to fetch ${ipAddress}: ${error.message}`);
        }
    }
}

// Function to save response to HTML file
function saveResponse(subnet, ipAddress, data) {
    if (!fs.existsSync(saveDir + "/" + subnet)) {
        fs.mkdirSync(saveDir + "/" + subnet);
    }
    fs.writeFileSync(`${saveDir}/${subnet}/${ipAddress}.html`, data);
}

const maxConnections = 50;

// Main function to execute the process
async function main() {
    let ips = await getIPs();
    let activeConnections = 0;
    let index = 0;

    async function processNext() {
        if (index >= ips.length) return;
        if (activeConnections >= maxConnections) return;

        let row = ips[index++];
        activeConnections++;
        fetchAndSave(row.ip, row.mask).finally(() => {
            activeConnections--;
            processNext();
        });
        processNext();
    }

    for (let i = 0; i < maxConnections; i++) {
        processNext();
    }
}

main();