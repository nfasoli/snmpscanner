const express = require("express");
const snmp = require("net-snmp");
const ip = require("ip");
const fs = require("fs");
const path = require("path");
const arp = require("@network-utils/arp-lookup");
const pingus = require("pingus");
const mysql = require("mysql2/promise");

const app = express();
const cors = require("cors");

app.use(cors());
const port = 5000;

const ricoh_oids = {
  SerialNumber: "1.3.6.1.4.1.367.3.2.1.2.1.4.0", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // HostName
  Hostname: "1.3.6.1.2.1.1.5.0", // Uptime
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  //Inventory: "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0", // Inv
  Model: "1.3.6.1.2.1.25.3.2.1.3.1",
  FW: "1.3.6.1.4.1.367.3.2.1.1.1.2.0",
  MAC: "1.3.6.1.2.1.2.2.1.6.1",
};

const toshiba_oids = {
  SerialNumber: "1.3.6.1.4.1.1129.1.2.1.1.1.1.1.0", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // HostName
  Hostname: "1.3.6.1.2.1.1.5.0", // Uptime
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  Inventory: "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0", // Inv
  Model: "1.3.6.1.2.1.25.3.2.1.3.1",
  FW: "1.3.6.1.4.1.1129.1.2.1.1.1.1.2.0",
  MAC: "1.3.6.1.2.1.2.2.1.6.1",
};

const lexmark_oids = {
  SerialNumber: "1.3.6.1.2.1.43.5.1.1.17.1", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // Uptime
  Hostname: "1.3.6.1.2.1.1.5.0", // Hostname
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  // Inventory: "1.3.6.1.4.1.641.2.1.2.1.7.1", // Inv
  Model: "1.3.6.1.4.1.641.2.1.2.1.2.1",
  FW: "1.3.6.1.4.1.641.2.1.2.1.4.1",
  MAC: "1.3.6.1.2.1.2.2.1.6.2",
};

const vendor_check = {
  lexmark: "1.3.6.1.4.1.641.2.1.2.1.4.1",
  ricoh: "1.3.6.1.4.1.1129.1.2.1.1.1.1.2.0",
  toshiba: "1.3.6.1.4.1.367.3.2.1.1.1.2.0",
};

const vendor_oids = {
  lexmark: lexmark_oids,
  ricoh: ricoh_oids,
  toshiba: toshiba_oids,
};

const vendor = {
  "78:8c:77": lexmark_oids,
  "00:21:b7": lexmark_oids,
  "00:04:24": toshiba_oids,
  "c8:3a:1b": toshiba_oids,
  "00:26:73": ricoh_oids, // RICOH
  "00:80:91": toshiba_oids,
  "58:38:79": ricoh_oids, // RICOH
  "00:30:ab": undefined, // DELTA NETWORKS,
  "00:00:74": ricoh_oids, // RICOH
  "00:04:24": toshiba_oids,
  "30:b5:c2": undefined, // TP_LINK
};

const vendor_name = {
  "78:8c:77": "lexmark",
  "00:21:b7": "lexmark",
  "00:04:24": "toshiba",
  "c8:3a:1b": "toshiba",
  "00:26:73": "ricoh", // RICOH
  "00:80:91": "toshiba",
  "58:38:79": "ricoh", // RICOH
  "00:30:ab": "delta", // DELTA NETWORKS,
  "00:00:74": "ricoh", // RICOH
  "00:04:24": "toshiba",
  "30:b5:c2": "tp-link", // TP_LINK
};

function swapped(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});
}

const dbConfig = {
  host: "localhost",
  user: "nicola",
  password: "Agrintesa2025",
  database: "printers",
};

function setSnmpData(ip, oid, value, community = "public") {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community);
    const varbinds = [
      {
        oid: oid,
        type: snmp.ObjectType.OctetString,
        value: value,
      },
    ];

    session.set(varbinds, (error, varbinds) => {
      if (error) {
        reject({ error: error.toString() });
      } else {
        resolve(varbinds);
      }
      session.close();
    });
  });
}

async function getSnmpData(ip, vendor, community = "public") {
  if (!vendor) return;
  const session = snmp.createSession(ip, community);

  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community);

    session.get(Object.values(vendor), (error, varbinds) => {
      if (error) {
        // se lexmark è probabile che l'oid dell'inventario non venga gradito
        // facciamo la scansione a mano
        reject(error);
      } else {
        const result = {};
        varbinds.forEach((varbind) => {
          if (snmp.isVarbindError(varbind)) {
            if (snmp.varbindError(varbind) == snmp.RequestTimedOutError)
              reject({ error: snmp.varbindError(varbind) });
          } else {
            result[swapped(vendor)[varbind.oid]] = varbind.value?.toString();
          }
        });
        resolve(result);
      }
      session.close();
    });
  });
}

/*
oids.forEach(function (oid) {
    session.get([oid], function (error, varbinds) {
        if (error) {
            console.error("Errore con OID " + oid + ": " + error.toString());
        } else {
            if (snmp.isVarbindError(varbinds[0])) {
                console.error("Errore nel varbind: " + snmp.varbindError(varbinds[0]));
            } else {
                console.log(varbinds[0].oid + " = " + varbinds[0].value);
            }
        }
    });
});
*/

async function saveToDatabase(ip, mac, vendor, data) {
  const connection = await mysql.createConnection(dbConfig);
  console.log("saveToDatabase init " + JSON.stringify(data));
  try {
    const query = `
      INSERT INTO printer (SerialNumber, Uptime, Hostname, Syslocation, Inventory, Model, FW, ip, MAC, vendor, lastupd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        Uptime = VALUES(Uptime),
        Hostname = VALUES(Hostname),
        Syslocation = VALUES(Syslocation),
        Inventory = VALUES(Inventory),
        Model = VALUES(Model),
        FW = VALUES(FW),
        ip = VALUES(ip),
        MAC = VALUES(MAC),
        vendor = VALUES(vendor),
        lastupd = NOW()
    `;

    console.log(
      `serialnumber: ${
        data.SerialNumber
      } ip ${ip} MAC ${mac} vendor ${JSON.stringify(vendor)}`
    );
    await connection.execute(query, [
      data.SerialNumber,
      data.Uptime,
      data.Hostname,
      data.Syslocation,
      data.Inventory ? data.Inventory : null,
      data.Model,
      data.FW,
      ip,
      mac,
      vendor,
    ]);
    console.log("Data for ip " + ip + " saved to database");
  } catch (err) {
    console.error("Error saving ip " + ip + " to database:", err);
    throw err;
  } finally {
    await connection.end();
  }
}

app.get("/snmp", async (req, res) => {
  const ip = req.query.ip;
  if (!ip) {
    return res.status(400).json({ error: "IP address is required" });
  }

  try {
    const p = await pingus.icmp({ host: ip });
    console.log(p);
    if (p.status == "timeout") {
      res.status(500).send(`ip ${ip} not online`);
      return;
    }

    const udp = await pingus.udp({ host: ip, port: 161 });
    console.log(udp);
    if (udp.status != "open") {
      res.status(500).send(`ip ${ip} SNMP disabled ${p.status}`);
      return;
    }

    let mac = await arp.toMAC(ip);
    // apparati a valle di device cisco ritornano mac mascherati
    if (mac && mac.slice(0, 8) != "00:00:0c") {
      console.log(
        `ip: ${ip}, MAC: ${mac}, vendor: ${
          vendor_name[mac.slice(0, 8)] || "sconosciuto"
        }`
      );
      brand = vendor[mac.slice(0, 8)];
      const data = await getSnmpData(ip, vendor[mac.slice(0, 8)]);
      await saveToDatabase(ip, mac, vendor_name[mac.slice(0, 8)], data);
      res.json(data);
    } else {
      try {
        console.log("IP outside subnet: going for SNMP: " + ip);
        // Intanto controllo che SNMP sia attivo

        // poi verifico la marca stampante
        // 641 = lexmark
        // 367 = ricoh
        // 1129 = toshiba
        let fw = undefined;
        let brand = undefined;

        for (const [b, v] of Object.entries(vendor_check)) {
          try {
            fw = await getSnmpData(ip, [v]);
            console.log(`IP ${ip} brand ${b}`);
            brand = b;
            break;
          } catch (wrong_brand) {
            console.log(`tried ${b} on ip ${ip} no match ${wrong_brand}`);
          }
        }

        if (!brand) {
          res.status(500).send("Brand not found for ip " + ip);
          return;
        }

        console.log(`ip: ${ip}, vendor: ${brand || "sconosciuto"}`);
        const data = await getSnmpData(ip, vendor_oids[brand]);
        console.log("data: " + data.MAC.length)
        const buffer = Buffer.from(data.MAC, "binary");

        // Converti il buffer in un array di byte
        const ba = Array.from(buffer);

        // Formatta l'array di byte come un MAC address
        mac = ba.map((byte) => byte.toString(16).padStart(2, "0")).join(":");
        data.MAC = mac;

        await saveToDatabase(ip, mac, brand, data);

        res.json(data);
      } catch (error) {
        console.log("error1 " + error);

        res.status(400).send("MAC not found");
      }
    }
  } catch (error) {
    console.log("IP outside subnet: going for SNMP3: " + error);

    res.status(500).json(error);
  }
});

app.get("/set", async (req, res) => {
  const { ip, inv } = req.query;
  if (!ip || !inv) {
    return res
      .status(400)
      .json({ error: "IP address and inv parameter are required" });
  }

  try {
    // const oid = "1.3.6.1.4.1.641.2.1.2.1.7.1";
    const oid = "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0"; // Inv

    await setSnmpData(ip, oid, inv);
    res.json({ message: "Value set successfully" });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get("/scan", async (req, res) => {
  const { subnet, netmask } = req.query;
  if (!subnet || !netmask) {
    return res.status(400).json({ error: "Subnet and netmask are required" });
  }

  try {
    const subnetInfo = ip.cidrSubnet(`${subnet}/${netmask}`);
    const firstIp = ip.toLong(subnetInfo.firstAddress);
    const lastIp = ip.toLong(subnetInfo.lastAddress);
    const results = [];
    const results_allip = [];

    const promises = [];
    for (let longIp = firstIp; longIp <= lastIp; longIp++) {
      const ipAddr = ip.fromLong(longIp);
      promises.push(
        (async () => {
          console.log("Scanning ipAddr: " + ipAddr);
          try {
            const p = await pingus.icmp({ host: ipAddr });

            if (p.status != "reply") {
              console.log(`pingus icmp error: ${ipAddr} p.status=${p.status}`);
              return;
            }

            const udp = await pingus.udp({ host: ipAddr, port: 161 });
            if (udp.status != "open") {
              console.log(`pingus udp error: ${ipAddr} p.status=${p.status}`);
              return;
            }

            console.log(`found something on ${ipAddr} p.status=${p.status}`);
            let mac = await arp.toMAC(ipAddr);
            if (mac && mac.slice(0, 8) != "00:00:0c") {
              console.log(
                `ip: ${ipAddr}, MAC: ${mac}, vendor: ${
                  vendor_name[mac.slice(0, 8)] || "sconosciuto"
                }`
              );
              let brand = vendor_name[mac.slice(0, 8)];
              results_allip.push(ipAddr);

              const data = await getSnmpData(ipAddr, vendor[mac.slice(0, 8)]);
              if (data) {
                results.push({ ip: ipAddr, MAC: mac, ...data });
                await saveToDatabase(ipAddr, mac, brand, data);
              }
            } else {
              try {
                console.log("IP outside subnet: going for SNMP: " + ipAddr);
                // Intanto controllo che SNMP sia attivo

                // poi verifico la marca stampante
                // 641 = lexmark
                // 1129 = toshiba
                let fw = undefined;
                let brand = undefined;

                for (const [b, v] of Object.entries(vendor_check)) {
                  try {
                    fw = await getSnmpData(ipAddr, [v]);
                    console.log(`IP ${ipAddr} brand ${b}`);
                    brand = b;
                    break;
                  } catch (wrong_brand) {
                    console.log(`tried ${b} on ip ${ipAddr} no match`);
                  }
                }
                results_allip.push(ipAddr);

                if (!brand)
                   return;

                console.log(`ip: ${ipAddr}, vendor: ${brand || "sconosciuto"}`);

                const data = await getSnmpData(ipAddr, vendor_oids[brand]);
                const buffer = Buffer.from(data.MAC, "binary");
4
                // Converti il buffer in un array di byte
                const ba = Array.from(buffer);

                // Formatta l'array di byte come un MAC address
                mac = ba
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join(":");
                data.MAC = mac;

                if (data) {
                  results.push({ ip: ipAddr, ...data });
                  await saveToDatabase(ipAddr, mac, brand, data);
                }

                //res.json(data);
              } catch (error) {
                console.log("MAC not found " + error);
              }
            }
          } catch (error) {
            console.log(
              "IP " + ipAddr + " outside subnet: errore generico " + error
            );
          }
        })()
      );
    }

    await Promise.all(promises);
    console.log(
      `result.len = ${results.length}, allip.len = ${results_allip.length}`
    );
    res.json({ results: results, ips: results_allip });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get("/getall", async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const query = `SELECT * from printers.printer order by ip`;

    const [rows, fields] = await connection.query(query);

    res.json(rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.toString() });
  } finally {
    await connection.end();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
