import { deepResearch } from "../src/lib/deep-research.server";
const t0 = Date.now();
const r = await deepResearch("adam", "تكلفة إعلانات فيسبوك للمطاعم في مصر", {
  industry: "مطاعم", city: "القاهرة", country: "EG", deepBudgetMs: 60_000,
});
console.log("ms:", Date.now() - t0);
console.log("used:", r.used);
console.log("block len:", r.block.length);
console.log(r.block.slice(0, 4000));
