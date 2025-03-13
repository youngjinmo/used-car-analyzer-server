import express from 'express';
import { type CarDatas, parseEncar } from './encar';
import { mongoClient } from './dbConnection';
import requestGpt from './openai';

const router = express.Router();

router.get('/ping', (req, res) => {
    console.log("ping called..");
    res.json({ message: "pong" });
});

router.post('/v1/openai/parse/encar', async (req, res) => {
    const url = req.query.url as string;

    if (!url || url.trim().length === 0) {
        console.error("❌ URL을 입력해주세요.");
        res.status(400).json({ result: "bad request", message: "URL을 입력해주세요." });
    }

    try {
        const encar = await parseEncar(url);

        console.log("🚗 gpt api 호출 : %s", encar.carId);
        const response = await requestGpt({
            prompt: "차량 이름=" + encar.carName +
                    ", 차량 가격=" + encar.price +
                    ", 차량 연식=" + encar.year +
                    ", 차량 주행거리=" + encar.mileage +
                    ", 차량 연료=" + encar.fuel +
                    ", 외판 교체 이력(1랭크)" + encar.externalHistory.firstRankExternal +
                    ", 외판 교체 이력(2랭크)" + encar.externalHistory.secondRankExternal +
                    ", 골격 교체 이력(A랭크)" + encar.frameHistory.aRank +
                    ", 골격 교체 이력(B랭크)" + encar.frameHistory.bRank +
                    ", 골격 교체 이력(C랭크)" + encar.frameHistory.cRank +
                    ", 보험 기준 차량 사고 이력=" + encar.accidentHistory +
                    ", 내차 피해 보험 이력=" + encar.insuranceAccidentCnt +
                    ", 렌트 이력 여부=" + encar.isRent +
                    ", 리콜 대상 여부=" + encar.isRecallTarget +
                    ", 리콜 여부=" + encar.hasRecall +
                    ", 소유자 변경 횟수=" + encar.ownerChangedCnt +
                    ", 엔카 진단여부=" + encar.encarDiagnosis +
                    "이 차량을 중고차로 구입해도 괜찮을지 알려줘. 다음의 기준으로 차량을 판단해서 해당 중고차 구입 추천할지 말지 알려줘" +
                    "차량 연식대비 주행거리가 연평균 7500 km 미만 이면서 연식이 10년이 되었다면 차량 관리가 잘 이뤄지지 않았을 가능성이 있으므로 낮은 점수를 줘." +
                    "만약 차량이 경유(디젤)차라면, 총 주행거리가 10만 km 미만이면서 연식대비 주행거리가 2만 km를 넘는다면 높은 점수를 줘. 디젤 엔진 특성상 장거리 주행이 도움이 되기 때문이야" +
                    "사고이력이 없고, 외판 교체이력도 없고, 골격 교체여부도 없다면 좋은 점수를 줘" +
                    "연식 대비 운전자(사용자) 교체가 잦다면 관리가 안되있을 가능성이 높으므로 낮은 점수를 줘" +
                    "차량이 렌트 이력이 있다면 낮은 점수를 줘" +
                    "리콜대상의 차량인데, 리콜을 하지 않았다면 낮은 점수를 줘" +
                    "엔카가 진단하지 않은 차량은 낮은 점수를 줘" +
                    "골격에 대한 교체 이력이 있다면 가장 낮은 점수를 주고 더 이상 차량 추천을 하지말아줘. 구입하기엔 가장 리스크가 큰 차량일것 같아"
            });

        if (!response) {
            throw new Error("GPT 응답이 존재하지 않습니다.");
        }

       console.log("🚗 gpt 응답 성공, carId=%d", encar.carId);
       res.json({ result: "ok", data: response });

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
            res.status(500).json({ result: "error", message: error?.message ?? "서버 오류 발생" });
        }
    } finally {
        await mongoClient.close();
    }
});

export default router;
