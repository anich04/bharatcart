import { config } from "dotenv";

// Load .env so integration tests hit the same database as the app.
config({ path: ".env" });

// Deterministic business rules for the tests, independent of local .env tweaks.
process.env.FREE_SHIPPING_THRESHOLD_PAISE = "49900";
process.env.SHIPPING_FLAT_PAISE = "4900";
process.env.COD_SURCHARGE_PAISE = "3000";
process.env.COD_MAX_ORDER_VALUE_PAISE = "500000";
process.env.SELLER_STATE = "Karnataka";
