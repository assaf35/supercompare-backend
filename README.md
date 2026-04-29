# SuperCompare Backend 🛒

שרת Node.js שמספק API למחירי סופרמרקטים ישראליים.
הנתונים מגיעים מקובצי XML של **חוק המזון (שקיפות מחירים)**.

---

## הרצה מקומית

```bash
# התקן dependencies
npm install

# הרץ שרת (יעדכן מחירים אוטומטית בהפעלה ראשונה)
npm start

# או בסביבת פיתוח עם nodemon
npm run dev
```

השרת יפעל על: `http://localhost:3000`

---

## API Endpoints

### חיפוש מוצרים
```
GET /api/v1/products/search?q=חלב תנובה&limit=20
```

**תגובה:**
```json
{
  "found": 5,
  "items": [
    {
      "itemCode": "7290000066768",
      "itemName": "חלב תנובה 3% שומן",
      "manufacturerName": "תנובה",
      "unitQty": "1 ליטר",
      "minPrice": 4.90,
      "chainCount": 6
    }
  ]
}
```

### מחירים לפי ברקוד
```
GET /api/v1/products/prices/7290000066768
GET /api/v1/products/prices/7290000066768?lat=32.08&lng=34.78&radius=20
```

**תגובה:**
```json
{
  "barcode": "7290000066768",
  "item_name": "חלב תנובה 3%",
  "prices": [
    {
      "chainId": "7290058140886",
      "chainName": "רמי לוי",
      "storeId": "001",
      "storeName": "רמי לוי ירושלים",
      "address": "רחוב הרצל 1",
      "city": "ירושלים",
      "price": 4.90,
      "isSale": false,
      "priceUpdateDate": "2026-04-29",
      "distanceKm": 2.3
    }
  ]
}
```

### Health Check
```
GET /health
```

---

## Deploy ל-Render.com (חינם)

1. **צור חשבון** ב-[render.com](https://render.com)
2. **Push לגיטהאב:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/supercompare-backend.git
   git push -u origin main
   ```
3. **ב-Render:**
   - לחץ **New → Web Service**
   - חבר את ה-repo מגיטהאב
   - Render יזהה אוטומטית את `render.yaml`
   - לחץ **Deploy**

4. **קבל את ה-URL** (למשל: `https://supercompare-backend.onrender.com`)

---

## עדכון האפליקציה לאחר Deploy

ב-`Modules.kt` שנה את Base URL של CHP ל-URL שלך:

```kotlin
@Named("chp")
fun provideChpRetrofit(...): Retrofit =
    Retrofit.Builder()
        .baseUrl("https://supercompare-backend.onrender.com/")  // ← הURL שלך
        ...
```

וב-`SupermarketApiService.kt` שנה את ה-endpoint:

```kotlin
interface ChpPriceApi {
    @GET("api/v1/products/prices/{itemCode}")
    suspend fun getPrices(
        @Path("itemCode") itemCode: String,
        @Query("lat") lat: Double? = null,
        @Query("lng") lng: Double? = null
    ): Response<PricesResponse>
}
```

---

## עדכון מחירים ידני

```bash
node src/services/priceUpdater.js
```

המחירים מתעדכנים אוטומטית כל יום ב-03:00 (שעון ישראל).
