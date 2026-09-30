import "./_loadLocalSeedEnv";
import { prisma } from "../lib/db";

type SeedPickupAddress = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: string;
  color: string;
  phone: string | null;
};

// Real production saved pickup locations (POWER store branches + one
// recycling partner), copied from a CustomPickupAddress export so the
// public site's saved-address search (PickupAddressAutocomplete) has
// realistic data to test against locally. Ids are freshly generated on
// insert rather than reusing the production ones, and no
// UserCustomPickupAddress assignments are recreated — local dev users don't
// correspond to whichever staff accounts had these assigned in production,
// and the public search doesn't use that scoping anyway.
const PICKUP_ADDRESSES: SeedPickupAddress[] = [
  { name: "POWER Drammen", address: "C O Lunds gate 25, 3043 Drammen, Norge", latitude: 59.73161678435927, longitude: 10.212826834826435, icon: "power", color: "amber", phone: null },
  { name: "POWER Slependen", address: "Nesbruveien 33, 1396 Billingstad, Norge", latitude: 59.875090788837824, longitude: 10.49872102907536, icon: "power", color: "amber", phone: null },
  { name: "POWER Rud", address: "Løxaveien 5, 1351 Rud, Norge", latitude: 59.90556185110419, longitude: 10.49224523103242, icon: "power", color: "amber", phone: null },
  { name: "POWER Skøyen", address: "Drammensveien 161, 0277 Oslo, Norge", latitude: 59.922564503870845, longitude: 10.676100906295645, icon: "power", color: "amber", phone: "+4790559466" },
  { name: "POWER Majorstuen", address: "Sørkedalsveien 33, 0369 Oslo, Norge", latitude: 59.93340872120602, longitude: 10.704312656186053, icon: "power", color: "amber", phone: null },
  { name: "POWER Lille Grensen", address: "Lille Grensen 5, 0159 Oslo, Norge", latitude: 59.91429562640633, longitude: 10.741298928905389, icon: "power", color: "amber", phone: null },
  { name: "POWER City", address: "Dronningens gate 40, 0154 Oslo, Norge", latitude: 59.91255835222392, longitude: 10.749292534540192, icon: "power", color: "amber", phone: null },
  { name: "POWER Grünerløkka", address: "Sannergata 2, 0557 Oslo, Norge", latitude: 59.92876146159102, longitude: 10.757742025088683, icon: "power", color: "amber", phone: null },
  { name: "POWER Alnabru", address: "Smalvollveien 65, 0667 Oslo, Norge", latitude: 59.923827699682576, longitude: 10.848077519609738, icon: "power", color: "amber", phone: null },
  { name: "POWER Skullerud", address: "Enebakkveien 300, 1188 Oslo, Norge", latitude: 59.87036996698091, longitude: 10.82996251040103, icon: "power", color: "amber", phone: null },
  { name: "POWER Lørenskog", address: "Solheimveien 6-8, 1461 Lørenskog, Norge", latitude: 59.93569653224447, longitude: 10.934653806198869, icon: "power", color: "amber", phone: "+4791133584" },
  { name: "POWER Strømmen", address: "Støperiveien 5, 2010 Strømmen, Norge", latitude: 59.948667600140496, longitude: 11.007641187168637, icon: "power", color: "amber", phone: "+4741434868" },
  { name: "POWER Ski", address: "Åsveien 11, 1424 Ski, Norge", latitude: 59.71342234817344, longitude: 10.833431066407574, icon: "power", color: "amber", phone: null },
  { name: "POWER Årnes", address: "Nedre Hagaveg 17C, 2150 Årnes, Norge", latitude: 60.11904549277463, longitude: 11.462673593964176, icon: "power", color: "amber", phone: null },
  { name: "POWER Askim", address: "Trøgstadveien 4, 1830 Askim, Norge", latitude: 59.585627306453816, longitude: 11.16772139742087, icon: "power", color: "amber", phone: null },
  { name: "POWER Fredrikstad", address: "Dikeveien 37, 1661 Rolvsøy, Norge", latitude: 59.25356942099686, longitude: 10.999207130342064, icon: "power", color: "amber", phone: null },
  { name: "POWER Halden", address: "Walkers gate 10, 1771 Halden", latitude: 59.12022880589335, longitude: 11.374553725762686, icon: "power", color: "amber", phone: null },
  { name: "POWER Honefoss", address: "Hvervenmoveien 2A, 3511 Hønefoss, Norge", latitude: 60.14563656924, longitude: 10.251514345472508, icon: "power", color: "amber", phone: null },
  { name: "POWER Jessheim", address: "Furusethgata 10, 2050 Jessheim, Norge", latitude: 60.14482881926389, longitude: 11.17169529200083, icon: "power", color: "amber", phone: "+4748121993" },
  { name: "POWER Kongsberg", address: "Schwabes gate 5, 3611 Kongsberg, Norge", latitude: 59.67285200174165, longitude: 9.648128597482671, icon: "power", color: "amber", phone: null },
  { name: "POWER Kongsvinger", address: "Otto Wengs Vei 7, 2212 Kongsvinger, Norge", latitude: 60.192841275663234, longitude: 11.992754956680765, icon: "power", color: "amber", phone: null },
  { name: "POWER Notodden", address: "Semsvegen 46, 3676 Notodden, Norge", latitude: 59.5678008090028, longitude: 9.217055932384557, icon: "power", color: "amber", phone: null },
  { name: "POWER Sandefjord", address: "Nygårdsveien 88, 3221 Sandefjord, Norge", latitude: 59.1394292942499, longitude: 10.176758528786278, icon: "power", color: "amber", phone: null },
  { name: "POWER Storo", address: "Vitaminveien 6, 0483 Oslo, Norge", latitude: 59.946130463240664, longitude: 10.774633837507466, icon: "power", color: "amber", phone: null },
  { name: "POWER Vestby", address: "Kleverveien 2, 1543 Vestby, Norge", latitude: 59.616764406175136, longitude: 10.739317972321901, icon: "power", color: "amber", phone: null },
  { name: "POWER Gjøvik", address: "Stampevegen 13, 2827 Hunndalen", latitude: 60.78698469099298, longitude: 10.665165521572733, icon: "power", color: "amber", phone: null },
  { name: "Franzefoss Gjenvinning", address: "Haraldrudveien 34, 0581 Oslo", latitude: 59.92611837615044, longitude: 10.8265893274063, icon: "mappin", color: "red", phone: null },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const entry of PICKUP_ADDRESSES) {
    const existing = await prisma.customPickupAddress.findFirst({ where: { name: entry.name } });

    if (existing) {
      await prisma.customPickupAddress.update({ where: { id: existing.id }, data: entry });
      updated++;
    } else {
      await prisma.customPickupAddress.create({ data: entry });
      created++;
    }
  }

  console.log(`Pickup addresses seeded: ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
