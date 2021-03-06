const nodefetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { JSDOM } = require('jsdom');

module.exports = async () => {
    db.vehicles.clear();
    let models = {};

    let ile = await fetch("https://www.ztm.waw.pl/baza-danych-pojazdow/").then(document => Number(document.querySelectorAll("li.page-numbers")[3].textContent.split(" ")[0]));

    for (let i = 1; i <= ile; i++) {
        let page = await fetch(`https://www.ztm.waw.pl/baza-danych-pojazdow/${i + 1 === 1 ? "" : `page/${i + 1}`}`).then(document => Object.values(document.querySelectorAll("a.grid-row-active")).map(a => a.href));
        await Promise.all(page.map(async (url) => {
            let vehicle = await fetch(url).then(document => Object.values(document.querySelectorAll("div.vehicle-details-entry")).map(x => x.children[1].textContent));

            if (vehicle[3] !== "Autobus" && vehicle[3] !== "Tramwaj") return;

            let realbus = await fetch(`https://realbus.pl/mapa/vehicle_info.php?tab=${vehicle[5]}&type=${vehicle[3] === "Autobus" ? "bus" : "tram"}&info_type=json`);

            let features = vehicle[9] ? vehicle[9].split(", ") : [];
            vehicle[8] !== "brak" ? features.push("automat biletowy") : null;

            db.vehicles.set(`${vehicle[3] === "Autobus" ? "bus" : "tram"}${vehicle[5]}`, {
                model: `${vehicle[0]} ${realbus.model || vehicle[1]}`,
                prodYear: vehicle[2],
                type: vehicle[3] === "Autobus" ? "bus" : "tram",
                registration: vehicle[4],
                tab: vehicle[5],
                carrier: vehicle[6],
                depot: vehicle[7],
                features: features,
                description: realbus.description
            });

            if (!models[`${vehicle[0]} ${realbus.model || vehicle[1]}`]) models[`${vehicle[0]} ${realbus.model || vehicle[1]}`] = [vehicle[5]];
            else models[`${vehicle[0]} ${realbus.model || vehicle[1]}`].push(vehicle[5]);

            return true;
        }));
    }

    console.log(`Vehicles: ${db.vehicles.size} | Bus: ${db.vehicles.filter(x => x.type === "bus").length} | Tram: ${db.vehicles.filter(x => x.type === "tram").length}`);
    db.vehicles.sync();
    db.models.setMany(models);
}

async function fetch(url, limit = 10) {
    let res = await nodefetch(url).catch(() => null);
    if (res) return (new JSDOM(await res.text())).window.document;
    if (limit === 0) return null;
    console.log(`Retry: ${url} | Left: ${limit}`)
    return fetch(url, limit - 1);
}