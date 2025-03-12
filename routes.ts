import express from 'express';
import { type CarInfo, type CarHistory, type InsuranceHistory, scrapeCarInfo, scrapeCarHistory, scrapeInsuranceHistory } from './encar';
import { mongoClient } from './dbConnection';

const router = express.Router();

// 엔카 차량 상세 페이지 URL 파싱
function parseEncarUrl(url: string): string {
    return url.split("?")[0];
}

interface CarDatas extends CarInfo, CarHistory, InsuranceHistory {}

function makeCarDatas(carInfo: CarInfo, carHistory: CarHistory, insuranceHistory: InsuranceHistory): CarDatas {
    return {
        ...carInfo,
        ...carHistory,
        ...insuranceHistory,
    };
}

router.get('/ping', (req, res) => {
    console.log("ping called..");
    res.json({ message: "pong" });
});

router.post('/scrape/encar/car-info', async (req, res) => {
    console.log("api called..");

    const url = req.query.url as string;

    if (!url || url.trim().length === 0) {
        console.error("❌ URL을 입력해주세요.");
        res.status(400).json({ result: "bad request", message: "URL을 입력해주세요." });
    }

    try {
        console.log("🚗 엔카 차량 정보 스크래핑 시작 : ", url);

        // parse car info
        const carInfo = await scrapeCarInfo(parseEncarUrl(url));
        const carHistories= await scrapeCarHistory(carInfo.carId);
        const insuranceHistories = await scrapeInsuranceHistory(carInfo.carId);

        console.log("\n🚗 애플리케이션 종료.");
        res.json({ result: "ok", data: makeCarDatas(carInfo, carHistories, insuranceHistories) });

        // connect mongodb
        // await mongoClient.connect();
        //
        // const connectionResult = await mongoClient.db("sample_mflix").collection("users").find({ name: 'Andy' }).toArray();
        // if (connectionResult) {
        //     console.log("\n몽고DB 연결상태 확인.");
        //     console.log(JSON.stringify(connectionResult, undefined, 2));
        // }
    } catch (error: any) {
        if (error.message === 'Could not find car') {
            console.log("이미 차량이 판매되었거나 삭제되었습니다.");
            res.status(404).json({ result: "not found", message: "차량이 판매되었거나 삭제되었습니다." });
        } else {
            console.error("❌ 오류 발생: %s", JSON.stringify(error));
            res.status(500).json({ result: "error", message: "서버 오류 발생" });
        }
    } finally {
        await mongoClient.close();
    }
});

export default router;
