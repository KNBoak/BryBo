/**
 * Al-Mar Vinyl Products Inc. seed data — sourced from ALMARSALES.pdf.
 *
 * Each row is `[accountName, [s2021, s2022, s2023, s2024, s2025, s2026]]`
 * where each entry is the annual sales total in dollars.
 *
 * Sales are seeded as `Event` records of type 'sale':
 *  - 2021–2025 amounts are attributed to Dec 31 of that year
 *  - 2026 (current year) amounts are attributed to the day before seeding runs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Account, Day, Event, EventAccount } from '@brybo/shared';
import { generateId } from '../utils/ids';
import { logInfo, logError } from '../utils/debug';

const TAG = 'AlMarSeed';

// Storage keys — must match AsyncStorageAdapter.KEYS.
const KEYS = {
  users: 'brybo_users',
  days: 'brybo_days',
  accounts: 'brybo_accounts',
  events: 'brybo_events',
  eventAccounts: 'brybo_eventAccounts',
} as const;

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026] as const;

type Row = readonly [string, readonly [number, number, number, number, number, number]];

const ACCOUNTS: readonly Row[] = [
  ['020 Design and Renovations', [0, 0, 0, 0, 2065.16, 0]],
  ['4Way Mfg Inc.', [0, 0, 0, 0, 5613.34, 0]],
  ['A-M Siding', [0, 607.20, 9845.79, 696.43, 0, 0]],
  ['A J Jackson Developments Limited', [2162.50, 3422.44, 2992.77, 0, 7182.29, 0]],
  ['A to Z Decks and StruXure', [0, 0, 0, 62843.23, 38509.57, 0]],
  ['A&A Contracting', [19232.81, 112.32, 0, 0, 0, 0]],
  ['A&H Custom Fence And Decks', [0, 0, 7305.04, 0, 1697.84, 0]],
  ['Above Board Renovations', [0, 0, 0, 1996.07, 0, 0]],
  ['Adams Building Supply Ltd - Shakespeare', [12967.57, 17300.86, 9181.34, 7824.54, 13424.58, 0]],
  ['Air Chimia Inc', [0, 518.74, 0, 0, 0, 0]],
  ['All Shores Fencing & Decks', [6083.68, 18397.32, 25949.88, 5970.94, 6043.87, 0]],
  ['Apply Contracting Ltd', [0, 0, 15022.26, 2974.72, 0, 0]],
  ['Aztec Enclosures', [20100.39, 21217.18, 3800.14, 5016.77, 0, 0]],
  ['B&L Farm Services', [12702.50, 39251.39, 15312.78, 20540.39, 3893.69, 0]],
  ['B&S Construction', [0, 82.80, 0, 2342.25, 0, 1696.50]],
  ['Back Country Excavating Inc', [0, 0, 7922.94, 0, 0, 0]],
  ['Barry Schmidt Contracting Inc.', [4078.95, 804.28, 762.08, 0, 1115.08, 0]],
  ['Batavia Development Inc.', [0, 0, 733.29, 0, 0, 0]],
  ['Bay Builders', [0, 0, 0, 0, 45018.39, 0]],
  ['Beaver Builders', [0, 0, 6659.49, 1189.65, 1295.74, 0]],
  ['Beingessner Home Exteriors', [2729.25, 1077.18, 857.43, 1243.27, 0, 0]],
  ['Beisel Contracting Inc.', [496.72, 14195.39, 5501.06, 2327.30, 24459.72, 0]],
  ['Belfor (Canada) Inc', [0, 9355.92, 0, 0, 0, 0]],
  ['Bell Renovations', [1063.05, 0, 0, 0, 0, 0]],
  ['Best Windows', [6735.54, 2885.30, 0, 0, 0, 0]],
  ['Bill Romano Contracting Ltd', [2901.50, 0, 0, 0, 0, 0]],
  ["BJ Dietrich's Aluminum Siding Ltd.", [2905.77, 0, 0, 348.98, 667.68, 0]],
  ['BMR PRO - Brechin (Severn Building)', [0, 0, 0, 0, 3733.32, 0]],
  ['BMR PRO - Elmvale', [0, 0, 0, 0, 3172.20, 0]],
  ['Bob Groenestege Carpentry Ltd.', [44409.12, 17535.00, 47919.43, 17167.14, 17236.37, 0]],
  ['Bogdanovic Construction Inc', [0, 0, 0, 0, 9000.68, 0]],
  ['Bosman Home Front Inc.', [13194.74, 35.60, 0, 571.68, 7747.97, 125.96]],
  ['Brick & Co. Restorations Ltd.', [0, 39666.06, 7492.32, 0, 1874.03, 23985.70]],
  ['Bridge Enterprise/2804380 Ontario Ltd.', [0, 0, 0, 0, 13049.66, 0]],
  ['Brussels Agri Services Ltd', [7368.09, 6045.10, 9146.86, 357.64, 0, 0]],
  ['Built Wright Fencing', [1088.41, 0, 0, 0, 27216.36, 0]],
  ['Burlington Fence Ltd.', [0, 0, 0, 0, 9595.48, 0]],
  ['Burloak Screens', [4458.25, 19886.65, 16002.60, 7338.64, 0, 0]],
  ['Burton Exteriors Inc.', [0, 0, 4259.54, 0, 0, 0]],
  ['Cash Sales', [80401.85, 48906.51, 19083.46, 53202.49, 56136.74, 1936.10]],
  ['Cheresh Homes Inc.', [0, 0, 5912.68, 0, 0, 0]],
  ['Chrisview Custom Homes Ltd', [0, 1882.08, 0, 0, 0, 0]],
  ['Circa Builds', [0, 946.35, 0, 0, 0, 0]],
  ['Clemente Carpentry', [0, 2662.94, 0, 0, 0, 0]],
  ['Columns Plus', [0, 0, 0, 0, 0, 242.00]],
  ['Compex Construction Inc', [0, 0, 0, 0, 4053.96, 0]],
  ['Conestogo Carpenters Ltd.', [9111.41, 29865.62, 15127.11, 10029.71, 23455.69, 5462.33]],
  ['Cutting Edge Contruction', [2828.94, 0, 3038.24, 0, 1117.11, 0]],
  ['D F 2000 Inc.', [0, 9376.66, 0, 23308.99, 0, 0]],
  ['D&S Contracting', [0, 0, 9845.67, 1347.31, 0, 0]],
  ['Davidson Site Works Inc', [0, 0, 2631.36, 1057.60, 27.68, 0]],
  ['Davis Fences', [0, 8704.75, -496.48, 0, 0, 0]],
  ['DC Fence & Contracting Inc', [0, 0, 4672.12, 3897.54, 4876.58, 0]],
  ['Deck Masters of Canada', [15883.75, 39900.10, 11144.52, 14123.10, 25597.67, 0]],
  ['Deck Pro Company Inc', [0, 0, 15376.73, 0, 0, 0]],
  ['Decks & Fences By Design', [4328.96, 0, 0, 0, 0, 0]],
  ['Decks By Premier', [72725.34, 243603.80, 144880.94, 5961.41, 0, 0]],
  ['Decks Unlimited', [0, 0, 236.05, 6625.00, 0, 0]],
  ['Distler Construction Ltd', [0, 0, 9360.04, 0, 0, 0]],
  ['Docks & Decks Unlimited', [9799.17, 0, 2757.25, 0, 0, 0]],
  ['Dun-Rite Aluminum see notes', [17447.27, 11582.73, 717.13, 13103.63, 0, 0]],
  ['Dungate Home Improvements', [8767.71, 0, 0, 0, 0, 0]],
  ['Dwyer Landscaping', [8760.85, 3095.21, 14830.56, 2913.39, 0, 0]],
  ['Early Riser Decking and Fencing', [0, 0, 0, 0, 28435.39, 0]],
  ['Earnest Properties Inc', [0, 0, 36287.51, 0, 2094.57, 0]],
  ['Ed Leimgardt Contracting Inc', [0, 0, 12035.24, 2464.16, 0, 0]],
  ['Edgewood Homes', [0, 74927.54, 40691.11, 23965.78, 11669.15, 0]],
  ['Edil Steel Manufacturing', [2786.28, 3046.79, 0, 0, 0, 0]],
  ['Elite Rail Construction Inc', [0, 467.06, 0, 0, 0, 0]],
  ['Euro Custom Homes Inc.', [34700.06, 42426.46, 50470.89, 4648.06, 0, 695.69]],
  ['FBMC Inc', [907.22, 0, 0, 30822.89, 8166.84, 0]],
  ['Feeney Design & Build', [0, 0, 0, 1976.60, 0, 0]],
  ['Fence & Deck Experts Inc.', [0, 0, 0, 2069.68, 0, 0]],
  ['Fence Source', [656.64, 0, 0, 0, 0, 0]],
  ['Festival City Glass', [126632.05, 154027.18, 86757.71, 5239.00, 0, 0]],
  ['FGC Limited', [818.56, 0, 0, 0, 0, 0]],
  ['Fortress Fencing', [5860.11, 0, 172.12, 4012.99, 13375.30, -358.87]],
  ['FTD Construction Inc', [0, 0, 7797.96, 0, 0, 0]],
  ['G&H Quality Roofing', [0, 374.80, 0, 0, 0, 0]],
  ['General Building Products', [478.40, 0, 606.21, 0, 0, 0]],
  ['Ghent Construction Ltd', [22584.93, 0, 1279.88, 5459.05, 0, 0]],
  ['Glen Allen Pillars', [18566.28, 2605.93, 11258.79, 5346.85, 10267.25, 0]],
  ['Great Lakes Decking Systems', [564.20, 1922.76, 1835.47, 2339.01, 5320.31, 0]],
  ['Great Lakes Landscape Contractors Inc.', [13335.38, 34040.40, 14638.51, 18904.22, 18460.97, 0]],
  ['Green Acres Landscape & Fence', [23702.23, 0, 0, 5.31, 0, 0]],
  ['Grey Bruce Patio Enclosures Inc.', [0, 0, 1204.21, 253.54, 0, 0]],
  ['Handley Lumber Ltd.', [0, 0, 0, 0, 65.20, 0]],
  ['Handyman on Demand', [0, 0, 0, 1696.56, 0, 0]],
  ['Harding Construction', [0, 0, 190.48, 0, 4153.08, 0]],
  ['Hardscape Niagara', [3753.32, 0, 0, 0, 0, 0]],
  ['HDD - Brad Arnold', [0, 3316.72, 0, 0, 0, 0]],
  ['HDD - Jamie Hurst', [0, 1020.00, 0, 0, 0, 0]],
  ['HDD - Niag/St. Cath -Peter Secord', [0, 0, 991.20, 0, 0, 0]],
  ['HDD - Rob Hendriks', [0, 0, 0, 13268.37, 0, 0]],
  ['HDD - Ryan Craig', [8967.34, 9099.53, 5836.48, 14466.17, 4134.42, 0]],
  ['Heritage Design', [11331.25, 6155.69, 14182.51, 20594.01, 56177.86, 3041.30]],
  ['HH - Barrie', [508.52, 1358.02, 68.15, 0, 20.18, 0]],
  ['HH - Blyth', [6229.20, 0, 0, 856.77, 1264.08, 0]],
  ['HH - Brussels - McDonald', [16944.80, 9253.61, 10645.37, 18469.81, 13210.93, 0]],
  ['HH - Drayton - Mar-Span', [0, 2855.75, 3587.26, 745.69, 47488.29, 0]],
  ['HH - Elmira - Mar-Span', [0, 0, 0, 0, 7135.45, 0]],
  ['HH - Fergus - Dixon', [0, 0, 118.61, 0, 4.50, 0]],
  ["HH - Gorrie - Watson's", [6600.87, 4609.15, 3782.87, 2834.93, 3493.45, 9.00]],
  ['HH - Grant Lumber', [47.84, 0, 0, 0, 0, 0]],
  ['HH - Hanover', [5758.08, 4141.57, 25190.16, 31919.76, 32092.96, 0]],
  ['HH - Kitchener - Swanson', [0, 470.13, 11453.43, 1598.85, 0, 272.89]],
  ["HH - Kurtzville - Watson's", [0, 0, 39.76, 78.76, 0, 0]],
  ["HH - Lion's Head - Wilson", [0, 2241.00, 0, 0, 112.22, 0]],
  ["HH - Listowel - Watson's", [8790.34, 26210.43, 1200.74, 4785.27, 2932.70, 0]],
  ['HH - Midland', [760.58, 0, 0, 0, 0, 0]],
  ["HH - Mt Forest - Young's", [24891.48, 18486.51, 21399.18, 27728.01, 1478.04, 0]],
  ['HH - Orillia Home Building', [3207.68, 0, 0, 0, 0, 47.91]],
  ["HH - Paisley - Allen's", [2267.24, 1425.60, 4349.70, 17.70, 7533.48, 0]],
  ['HH - Plattsville', [0, 671.85, 118.80, 0, 0, 0]],
  ['HH - Port Elgin', [522.56, 0, 0, 41008.48, 0, 2032.26]],
  ['HH - Sauble Beach', [100.00, 31.55, 0, 0, 834.76, 0]],
  ['HH - Smithville', [0, 0, 0, 910.88, 0, 0]],
  ['HH - St. Jacobs - Fairway', [0, 0, 0, 1883.30, 0, 0]],
  ['HH - Stratford', [1889.10, 2996.94, 0, 1618.32, 1903.99, 4.80]],
  ['HH - Sudbury', [0, 0, 0, 0, 2499.63, 0]],
  ["HH - Sundridge - Kidd's", [108.02, 0, 0, 0, 0, 0]],
  ['HH - Sutton', [0, 2071.20, 0, 0, 5281.32, 0]],
  ['HH - Tavistock - Yantzi', [41733.34, 28346.37, 18124.58, 10378.49, 4114.56, 1.70]],
  ['HH - Thornbury', [0, 0, 56.75, 0, 0, 0]],
  ['HH - Timmins', [2162.08, 0, 0, 0, 0, 0]],
  ['HH - Walkerton', [0, 0, 0, 0, 749.67, 0]],
  ['HH - Welbeck Sawmill Ltd.', [0, 1894.29, 0, 17.70, 0, 0]],
  ['HH - Wiarton', [0, 965.32, 0, 0, 0, 0]],
  ['Highland Fence & Supply Inc.', [0, 0, 0, 22.06, 0, 0]],
  ['Hodgins Building Centre Port Elgin', [0, 0, 0, 0, 1679.65, 0]],
  ['Hodgins Lumber Lucknow Limited', [5926.79, 112.19, 6192.83, 1594.28, 1525.69, 0]],
  ['Hodgins Lumber Wingham Limited', [49613.88, 36140.20, 55135.79, 74298.35, 76590.07, 0]],
  ['Home Siding Shop', [16138.11, 8698.70, 0, 15884.98, 10202.80, 2967.23]],
  ['Homescape Handyman Services', [0, 0, 0, 12531.31, 9740.94, 0]],
  ['Hulshof, Brent', [25552.95, 444.40, 0, 0, 0, 0]],
  ['Huron Creek Holdings Corp', [0, 5563.92, 0, 0, 0, 0]],
  ['Husband For Hire', [0, 513.74, 0, 0, 0, 0]],
  ['Infinity Decks', [535.42, 0, 0, 0, 0, 0]],
  ['Ingold Fence & Deck', [0, 0, 0, 14516.59, 0, 0]],
  ['Ivo Custom Exteriors', [0, 0, 14746.11, 5287.28, 0, 0]],
  ['Jantzi, Brian', [10982.54, 0, 0, 0, 0, 0]],
  ['Jay Fencing Ltd.', [165727.76, 184137.41, 154760.61, 91700.37, 87495.86, 0]],
  ['Jeff Stewart Carpentry', [3420.51, 8713.30, 18834.09, 2142.72, 14525.70, 0]],
  ['Jeff Sykes Carpentry', [0, 20463.68, 9292.43, 751.71, 8060.62, 0]],
  ['Jim Van Osch Construction Ltd.', [0, 1854.10, 193.04, 675.64, 0, 0]],
  ['JNR Exteriors & Renovations', [0, 0, 5746.80, 3595.72, 0, 0]],
  ['Just Decks', [0, 0, 0, 0, 16207.17, 0]],
  ['JWS Woodworking & Design', [2111.88, 4307.88, 0, 0, 2032.27, 0]],
  ["K-Nick's Custom Carpentry", [0, 0, 1091.32, 0, 0, 0]],
  ['Kaebrose Home Improvement', [0, 345.18, 6341.73, 0, 3871.64, 0]],
  ['Kelly Lake Building Supplies', [12921.17, 6684.34, 11824.04, 5483.90, 6649.29, 0]],
  ['King Fence', [0, 3169.70, 0, 0, 45028.99, 0]],
  ['Kirbyson Construction', [0, 0, 0, 148.88, 35.92, 0]],
  ['Knowles Building Centre', [18560.00, 6835.20, 7810.99, 476.67, 186.92, 0]],
  ['Kurtz Construction', [31948.28, 18124.51, 0, 0, 0, 0]],
  ["Lang's General Contracting Inc.", [1442.20, 0, 0, 0, 0, 0]],
  ['Lincoln Smith & Sons Lumber Ltd', [14599.44, 0, 0, 0, 0, 0]],
  ['Listowel Farm Supply', [0, 0, 0, 1833.54, 0, 0]],
  ['Luke Merkel Carpentry Inc', [0, 0, 16424.05, 3887.57, 2755.84, 0]],
  ['Lumbermax', [0, 41043.31, 69238.94, 24973.55, 20884.58, 0]],
  ['M&G Fencing Inc.', [68212.06, 123758.32, 67609.20, 90428.81, 116000.07, 0]],
  ['Mariposa Homes Inc.', [0, 0, 0, 0, 3584.76, 0]],
  ['McFaul Fencing Ltd.', [596.82, 6197.98, 0, 9264.87, 35902.35, 0]],
  ['Meinen Custom Homes', [0, 0, 2145.61, 0, 0, 0]],
  ['Mendler Electric', [1655.20, 0, 0, 0, 0, 0]],
  ['Milestone Carpentry', [0, 0, 24665.37, 0, 0, 0]],
  ['MKW Services', [0, 0, 0, 550.60, 0, 0]],
  ['Moffatt & Powell - Mitchell', [25275.08, 11740.29, 23511.22, 14647.72, 12588.68, 18585.51]],
  ['Moffatt & Powell Rona - Hanover', [5232.80, 2788.80, 58.83, 572.12, 2315.40, 0]],
  ['Mooder Horticultural Inc.', [13481.92, 7193.79, 0, 5017.95, 7924.18, 0]],
  ['Moura Family Holdings Ltd (Chrisview)', [0, 0, 22309.46, 567.06, 5651.95, 0]],
  ['MSD Contracting', [0, 0, 0, 11710.59, 4112.01, 0]],
  ['MtH Contracting & Consulting Ltd', [0, 0, 0, 0, 4896.15, 0]],
  ['Muskoka Timber Mills', [0, 0, 0, 0, 977.29, 0]],
  ['N R Renovations Ltd.', [3727.73, 4647.13, 1930.77, 19726.50, 3174.68, 502.20]],
  ['National Decking', [70331.14, 0, 0, 3588.70, 0, 0]],
  ['New Trend Corporation', [29388.77, 2412.08, 477.16, 2763.28, 3875.73, 11437.05]],
  ['Niagara Building Centre', [0, 0, 6346.75, 0, 8889.38, 0]],
  ['Niagara Outdoor Landscape', [20854.88, 2076.50, 3770.08, 0, 0, 0]],
  ['Nipissing Siding & Windows', [7991.26, 0, 0, 0, 0, 0]],
  ['Noordegraaf Enterprises Inc.', [67225.66, 29263.48, 93326.71, 22809.78, 25973.41, 0]],
  ['Norfolk County Contracting', [31340.92, 82862.25, 29225.37, 26951.40, 3789.92, 0]],
  ['North Huron Carpentry', [21994.46, 14223.50, 4801.77, 11743.18, 22555.88, 0]],
  ['Northern Fencing', [11772.79, 15770.56, 5689.06, 24156.15, 23029.41, 0]],
  ['Northern Patio Design', [0, 0, 0, 3679.04, 1608.50, 0]],
  ['Northern Windows and Doors', [11936.12, 0, 12304.95, 1874.70, 47445.80, 0]],
  ['Northstar Carpentry', [3648.44, 1138.18, 749.84, 0, 0, 0]],
  ["O'Brien Fabricating Ltd", [0, 12420.76, 0, 0, 0, 0]],
  ['Obsidian Access (RMW Exteriors)', [3599.17, 996.98, 1328.58, 4967.67, 459.59, 323.56]],
  ['Ottewell Enterprises Ltd.', [835.92, 15060.58, 0, 0, 0, 0]],
  ['Outdoor Living Niagara Inc', [4850.56, 0, 0, 0, 0, 0]],
  ['Perimeter Fence & Deck', [12076.01, 0, 0, 15961.59, 24377.76, 519.31]],
  ['Pines Landscaping', [0, 0, 38932.16, 67199.47, 8096.25, 0]],
  ['Pinnacle Building Group', [41532.69, 92655.54, 42534.64, 44417.71, 45672.82, 0]],
  ['Pinnacle Quatlity Homes/1343877 Ont Ltd', [16504.61, 22289.20, 17301.11, 12975.05, 3105.41, 0]],
  ['Player Carpentry & Masonry Inc.', [0, 541.84, 698.54, 1809.70, 0, 0]],
  ['Point North Fence', [2974.28, 6314.68, 4830.96, 15336.64, 0, 29471.24]],
  ['Post Time Services Inc.', [0, 46562.11, 1113.81, 3898.39, 1628.86, 0]],
  ['Powell Fence Ltd', [0, 0, 1853.90, 589.51, 0, 0]],
  ['Precision Deck & Fence *** FLAGGED', [3651.97, 0, 1951.94, 11367.35, 0, 0]],
  ['Premier Fence', [101624.48, 1582.57, 1675.39, 90775.31, 88757.86, 0]],
  ['Proactive Asset Solutions Inc', [0, 0, 1438.44, 0, 0, 0]],
  ['Progress Centre', [9183.43, 2684.08, 4852.69, 2366.07, 255.19, 0]],
  ['Quality Homes', [72707.43, 56264.04, 61937.01, 22963.67, 16848.37, 9662.96]],
  ['Quality Plus Carpentry', [0, 1803.20, 0, 0, 0, 0]],
  ['R.B Contractors Inc.', [0, 0, 0, 0, 1949.36, 0]],
  ['Ready Shedy', [0, 14216.33, 0, 0, 0, 0]],
  ['Rees Renovations', [0, 0, 0, 85.00, 0, 0]],
  ['Resolut Construction Inc', [0, 0, 85.00, 0, 15341.04, 0]],
  ['Rick The Handyman', [0, 0, 7813.41, 0, 0, 0]],
  ['Riehl Contracting Inc', [10232.81, 0, 0, 0, 0, 0]],
  ['Rivers Edge Garden Centre & Landscaping', [0, 0, 0, 18709.97, 0, 0]],
  ['Riverside Glass', [3941.33, 4217.80, 13342.76, 15294.42, 25269.26, 1616.16]],
  ['Roma Fence-Bolton', [6092.94, 5491.17, 0, 0, 0, 0]],
  ['Roma Fence-Milton', [0, 0, 0, 0, 132.48, 0]],
  ['Rona - East Gwillimbury', [0, 0, 0, 65.78, 0, 0]],
  ['Rona - Elora', [395.28, 4967.50, 130.29, 0, 0, 0]],
  ['Rona - Guelph - Dawson', [0, 0, 0, 3841.96, 3862.15, -207.03]],
  ['Rona - Kincardine', [1397.25, 13117.83, 2528.61, 3797.91, 0, 0]],
  ['Rona - Kitchener/Boyer', [26706.14, 15744.25, 33980.37, 14403.36, 0, 0]],
  ['Rona - North Bay 1 (Memorial Dr)', [0, 0, 0, 0, 0, 0]],
  ['Rona - North Bay 2 (McGaughey Ave)', [20507.46, 5309.12, 5910.45, 784.12, 8108.20, 0]],
  ['Rona - Sonnenburg', [0, 784.69, 0, 0, 0, 0]],
  ['Rona - Southhampton', [897.76, 11564.04, 1040.18, 1766.93, 254.41, 0]],
  ['Rona - St. Catharines', [11700.64, 328.17, 0, 119.04, 967.53, 0]],
  ['Rona - Uxbridge', [1938.16, 540.04, 0, 0, 1018.76, 0]],
  ['Rona - Welland', [374.18, 609.35, 0, 3547.26, 3646.17, 0]],
  ['Rosenberg Building Supply Inc.', [347.44, 0, 0, 0, 0, 0]],
  ['Royal Decks Co. Inc.', [231541.53, 278477.13, 149059.96, 77667.58, 45448.52, 9430.59]],
  ['Royal Homes Corporation', [11016.08, 8897.60, 3565.92, 3731.62, 943.36, 0]],
  ['Royal Landscaping Niagara Ltd', [0, 0, 3500.34, 0, 0, 0]],
  ['Ruetz Contracting', [4915.27, 15920.07, 14316.49, 6617.55, 385.46, 0]],
  ['Scenic Fence & Decks', [9147.86, 494.52, 3180.36, 12772.11, 14770.80, 0]],
  ['SD Decking Inc.', [91097.02, 79234.36, 61554.32, 33875.98, 2441.88, 0]],
  ['Secure Orbit Inc', [0, 0, 1369.76, 15550.46, 31993.78, 4243.02]],
  ['Serenity Decks', [298379.34, 164356.47, 56243.22, 19481.66, 53989.38, 854.54]],
  ['Silver Maple Landscaping', [0, 3237.84, 4408.67, 0, 0, 0]],
  ['Simcoe Building Centre', [4997.51, 2152.71, 2158.25, 504.52, 10530.03, 0]],
  ['Simcoe Decks', [4254.76, 0, 0, 0, 0, 0]],
  ['Sirignano Contracting', [0, 0, 19834.00, 1664.04, 0, 0]],
  ['SLP Inc', [0, 3151.28, 0, 0, 0, 0]],
  ['Solid Word', [0, 0, 0, 0, 12801.26, 0]],
  ['South Parry Lumber', [0, 0, 0, 0, 2666.25, 0]],
  ['St Catharines Building Supply', [14297.50, 12354.02, 5215.02, 4106.52, 2958.52, 3985.83]],
  ['Star Fencing', [0, 0, 0, 16152.00, 23504.85, 0]],
  ['Straight Lace Contracting Inc', [0, 1025.68, 866.48, 0, 0, 0]],
  ['Sturdy Projects Limited', [0, 0, 870.40, 0, 0, 0]],
  ['Sudek Railing & Fence', [5517.13, 2823.41, 0, 620.04, 2495.08, 0]],
  ['Sun Rise Seamless Eavestroughing Inc.', [15994.82, 8048.29, 11491.79, 3394.00, 11854.49, 465.04]],
  ['Sunset Industries Inc.', [23832.15, 0, 30390.65, 12012.52, 0, 0]],
  ['System Equine Fencing Limited', [0, 0, 0, 0, 16256.40, 0]],
  ['Telfer Homes', [0, 0, 4892.05, 110.00, 10228.61, 0]],
  ['The Deck Store-Oakville', [37678.62, 46214.15, 21385.56, 15881.34, 30713.70, 0]],
  ['The Window Doctor', [25733.36, 0, 10641.48, 8434.67, 0, 0]],
  ['TimBr Mart - Barrie - Alpha Building', [0, 0, 85.00, 0, 0, 0]],
  ['TimBr Mart - Earlton', [2217.70, 7235.18, 0, 0, 1502.02, 0]],
  ['TimBr Mart - Guelph Building Supply', [1893.82, 302.86, 0, 0, 0, 0]],
  ['TimBr Mart - Hillsburg - McKinnon', [17.66, 2571.74, 2193.32, 0, 0, 0]],
  ['TimBr Mart - Huronia Steel Sales', [329.31, 4076.93, 0, 409.52, 1394.38, 0]],
  ['TimBr Mart - Lyons-Sault', [9922.91, 407.70, 37.50, 689.27, 19894.85, 0]],
  ['TimBr Mart - Murphys', [13547.28, 3216.47, 824.52, 7205.39, 141.40, 0]],
  ['TimBr Mart - Orangeville', [4815.67, 0, 0, 0, 0, 0]],
  ['TimBr Mart - Orillia Trim & Door', [3958.21, 5140.75, 15582.78, 1446.84, 22389.28, 0]],
  ['TimBr Mart - Porcupine', [0, 0, 3267.05, 170.25, 0, 0]],
  ['TimBr Mart - Severn - Coldwater (IND)', [143.11, 0, 700.87, 0, 0, 0]],
  ['TimBr Mart - Timmins', [0, 0, 3727.36, 0, 0, 0]],
  ['TimBr Mart - Walkerton', [3433.66, 2462.68, 11959.52, 1480.82, 10694.10, 52.30]],
  ['Town & Country Fence-Guelph', [711.80, 0, 0, 0, 0, 0]],
  ['Trans Canada Wood Products Ltd.', [2978.44, 0, 0, 0, 0, 0]],
  ['Trinity Green Construction', [0, 17777.33, 22274.06, 0, 0, 0]],
  ['Triple V Eavestrough', [2067.46, 1091.39, 766.88, 9.45, 472.56, 0]],
  ['Tropical Forest Products', [434198.85, 6069.80, 0, 0, 0, 0]],
  ['Tropical Sunrooms Inc.', [1411.89, 6146.78, 7912.30, 10916.08, 378.35, 0]],
  ['Turkstra Lumber - Hamilton', [0, 0, 2907.36, 0, 0, 0]],
  ['Turkstra Lumber - Stoney Creek', [0, 746.23, 218.55, 3726.40, 0, 0]],
  ['Turkstra Lumber - Waterdown', [260.88, 2571.42, 9448.99, 0, 0, 0]],
  ['Tuscan Landscapes Ltd.', [0, 0, 0, 0, 9439.08, 0]],
  ['Urban Windows', [7048.92, 0, 0, 0, 0, 0]],
  ['UrbanRenos', [639.98, 0, 0, 0, 0, 0]],
  ['VAL Fencing', [0, 6100.64, 0, 0, 0, 0]],
  ['Venema Holdings Inc.', [0, 0, 0, 0, 3731.68, 0]],
  ['Ventway Systems', [6392.04, 0, 0, 0, 0, 0]],
  ["Wagler's Carpentry Inc", [2578.96, 19043.08, 7242.92, 13456.90, 1092.32, 0]],
  ['WayMar Inc.', [50919.19, 43946.24, 69539.71, 24591.00, 64680.58, 7.28]],
  ['Wellesley Home Ctre', [35553.40, 92118.96, 44457.49, 19816.91, 40555.30, 14051.04]],
  ['Wellington Pool & Hardscapes Ltd.', [0, 0, 0, 14454.26, -356.15, 0]],
  ['Williams Outdoors Inc.', [20479.77, 7739.15, 10030.14, 2199.00, 1514.61, 0]],
  ['Willowgrove Homes Inc', [0, 8718.08, 0, 0, 0, 0]],
  ['Z Modular', [0, 2823.00, 0, 0, 0, 0]],
  ['Ziegler Lumber Ltd.', [865.80, 0, 2030.20, 0, 0, 0]],
  ['Zyta Group Inc.', [2890.00, 3779.52, 2778.60, 245.72, 7.00, 0]],
];

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readArr<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

/**
 * Seeds the Al-Mar demo profile alongside any existing data. Idempotent:
 * skips if a user named "Al-Mar" is already present. Merges into existing
 * AsyncStorage arrays so other profiles and their data are preserved.
 */
export async function seedAlMarIfMissing(): Promise<boolean> {
  try {
    const existingUsers = await readArr<User>(KEYS.users);
    if (existingUsers.some((u) => u.name === 'Al-Mar')) {
      logInfo(TAG, 'skipping seed; Al-Mar profile already exists');
      return false;
    }

    logInfo(TAG, 'seeding Al-Mar profile', { accounts: ACCOUNTS.length });
    const now = new Date().toISOString();
    const todayMinus1 = yesterdayIso();

    const user: User = {
      id: generateId(),
      name: 'Al-Mar',
      color: '#0f766e',
      created_at: now,
    };

    const newDays: Day[] = YEARS.map((year) => ({
      id: generateId(),
      user_id: user.id,
      date: year === 2026 ? todayMinus1 : `${year}-12-31`,
      notes: null,
      created_at: now,
      updated_at: now,
    }));
    const dayByYear = new Map(YEARS.map((y, i) => [y, newDays[i]]));

    const newAccounts: Account[] = [];
    const newEvents: Event[] = [];
    const newEventAccounts: EventAccount[] = [];

    for (const [name, sales] of ACCOUNTS) {
      const hasAnySales = sales.some((s) => s !== 0);
      const account: Account = {
        id: generateId(),
        user_id: user.id,
        name,
        city: null,
        state: null,
        addresses: [],
        phone: null,
        website: null,
        notes: null,
        is_prospect: !hasAnySales,
        is_archived: false,
        level: null,
        primary_contact_id: null,
        created_at: now,
        updated_at: now,
      };
      newAccounts.push(account);

      for (let i = 0; i < YEARS.length; i++) {
        const amount = sales[i];
        if (amount === 0) continue;
        const day = dayByYear.get(YEARS[i])!;
        const event: Event = {
          id: generateId(),
          user_id: user.id,
          day_id: day.id,
          type: 'sale',
          kind: 'note',
          status: 'done',
          notes: null,
          amount,
          is_cancelled: false,
          source_event_id: null,
          created_at: now,
          updated_at: now,
        };
        newEvents.push(event);
        newEventAccounts.push({ event_id: event.id, account_id: account.id });
      }
    }

    // Merge with existing storage so other profiles and their data survive.
    const [
      existingDays,
      existingAccounts,
      existingEvents,
      existingEventAccounts,
    ] = await Promise.all([
      readArr<Day>(KEYS.days),
      readArr<Account>(KEYS.accounts),
      readArr<Event>(KEYS.events),
      readArr<EventAccount>(KEYS.eventAccounts),
    ]);

    await AsyncStorage.multiSet([
      [KEYS.users, JSON.stringify([...existingUsers, user])],
      [KEYS.days, JSON.stringify([...existingDays, ...newDays])],
      [KEYS.accounts, JSON.stringify([...existingAccounts, ...newAccounts])],
      [KEYS.events, JSON.stringify([...existingEvents, ...newEvents])],
      [KEYS.eventAccounts, JSON.stringify([...existingEventAccounts, ...newEventAccounts])],
    ]);

    logInfo(TAG, 'seed complete', {
      accounts: newAccounts.length,
      events: newEvents.length,
      eventAccounts: newEventAccounts.length,
    });
    return true;
  } catch (e) {
    logError(TAG, 'seed failed', e);
    return false;
  }
}
