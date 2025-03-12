import { type CarInfo, type CarHistory, type InsuranceHistory, scrapeCarInfo, scrapeCarHistory, scrapeInsuranceHistory } from './encar';
import { mongoClient } from './dbConnection';

interface CarDatas extends CarInfo, CarHistory, InsuranceHistory {}

// 엔카 차량 상세 페이지 URL 파싱
function parseEncarUrl(url: string): string {
    return url.split("?")[0];
}

function makeCarDatas(carInfo: CarInfo, carHistory: CarHistory, insuranceHistory: InsuranceHistory): CarDatas {
    return {
        ...carInfo,
        ...carHistory,
        ...insuranceHistory,
    };
}

async function app(url: string) {
    try {
        // parse car info
        const carInfo = await scrapeCarInfo(parseEncarUrl(url));
        const carHistories= await scrapeCarHistory(carInfo.carId);
        const insuranceHistories = await scrapeInsuranceHistory(carInfo.carId);

        console.log(JSON.stringify(makeCarDatas(carInfo, carHistories, insuranceHistories), undefined, 2));
        console.log("\n애플리케이션 종료.");

        // connect mongodb
        await mongoClient.connect();

        const connectionResult = await mongoClient.db("sample_mflix").collection("users").find({ name: 'Andy' }).toArray();
        if (connectionResult) {
            console.log("\n몽고DB 연결상태 확인.");
            console.log(JSON.stringify(connectionResult, undefined, 2));
        }
    } catch (error: any) {
        if (error.message === 'Could not find car') {
            console.log("이미 차량이 판매되었거나 삭제되었습니다.");
        } else {
            console.error("❌ 오류 발생:", error);
        }
    } finally {
        await mongoClient.close();
    }
}

// 실행
const url = "https://fem.encar.com/cars/detail/39060331";
app(url);
