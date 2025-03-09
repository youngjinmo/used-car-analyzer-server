import puppeteer, { Browser, Page } from 'puppeteer';
import { mongoClient } from './dbConnection';

interface CarInfo {
    carId: string; // 엔카 차량등록번호
    price: string; // 엔카 차량판매가격
    encarDiagnosis: boolean; // 엔카 진단 여부
}

interface CarHistory {
    year: string; // 연식
    carName: string; // 차량명
    carNumber: string; // 차량번호
    mileage: number; // 주행거리
    fuel: string; // 연료
    externalHistory: { firstRankExternal: string; secondRankExternal: string }; // 외판 교체 이력
    frameHistory: { aRank: string; bRank: string; cRank: string }; // 골격 교체 이력
    accidentHistory: boolean; // 사고이력
    isRent: boolean; // 렌트이력
    isRecallTarget: boolean; // 리콜대상 여부
    hasRecall: boolean; // 리콜 여부
}

interface InsuranceHistory {
    ownerChangedCnt: number, // 소유자 변경 횟수
    insuranceAccidentCnt: number, // 보험이력횟수 (내차피해)
}

interface CarDatas extends CarInfo, CarHistory, InsuranceHistory {}

function parseEncarUrl(url: string): string {
    return url.split("?")[0];
}

// TODO 아래 함수들은 모두 non 엔카 진단 차량에 대한 정보임. 크롤링 초반 엔카 차량인지 여부 파악하여 분기(separation) 필요.
async function scrapeCarInfo(url: string): Promise<CarInfo> {
    const browser: Browser = await puppeteer.launch({ headless: false });

    try {
        // 1️⃣ 엔카 차량 상세 페이지 열기
        const page: Page = await browser.newPage();
        await page.setViewport({
            width: 1200,
            height: 750,
        });

        // console.log(`🔍 페이지 열기: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // // 요소가 로드될 때까지 대기
        const selector: string = '#detailStatus > div.ResponsiveTemplete_title_type__61dhW > h4';
        await page.waitForSelector(selector, { visible: true, timeout: 10000 });

        // 1. 엔카 진단 여부 추출
        const encarDiagnosis = await page.evaluate(() => {
            const diagnosisButton = document.querySelector("#detailStatus > div.ResponsiveTemplete_box_type__10yIs > div.ResponsiveTemplete_text_image_type__tycpJ > div.ResponsiveTemplete_button_type__pjT76 > button");
            if (diagnosisButton) {
                return diagnosisButton.textContent?.includes("엔카진단") || false;
            }
            throw false;
        }).catch(() => false);

        // 2. 엔카 차량등록번호 추출
        const carId = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#detailInfomation > div > div > div.DetailCarPhotoPc_img_big__LNVDo > div.DetailCarPhotoPc_img_top__OkPjS > ul > li:nth-child(1)");
            if (ulElement) {
                return ulElement.innerText.slice(5).trim(); // 5번째 인덱스부터 잘라서 반환
            }
            throw new Error('Could not find element');
        });

        if (!carId) {
            console.error("❌ 해당 차량 등록번호를 찾을 수 없습니다.");
            throw new Error('Could not find car id');
        }

        // 3. 엔카 차량 판매가격 추출
        const price = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#wrap > div > div.Layout_contents__MD95o > div.ResponsiveLayout_wrap__XLqcM > div.ResponsiveLayout_lead_area__HGM3g > div > div.DetailLeadBottomPc_lead_area__p0V0t > div.DetailLeadBottomPc_price_wrap__XlHcb > p > span");
            if (ulElement) {
                return ulElement.innerText.trim();
            }
            throw new Error('Could not find price');
        });

        if (!price) {
            console.error("❌ 해당 차량 가격을 찾을 수 없습니다.");
            throw new Error('Could not find price');
        }

        return { carId, price, encarDiagnosis };
    } catch (error) {
        console.error("❌ 오류 발생:", error);
        throw error;
    } finally {
        await browser.close();
        console.log("차량등록번호 크롤링 완료.");
    }
}

async function scrapeCarHistory(carId: string): Promise<CarHistory> {
    const url = `https://www.encar.com/md/sl/mdsl_regcar.do?method=inspectionViewNew&carid=${carId}`;
    const browser: Browser = await puppeteer.launch({ headless: false });

    const result: CarHistory = {
        year: "모름",
        carName: "모름",
        carNumber: "모름",
        mileage: 0,
        fuel: "모름",
        externalHistory: {
            firstRankExternal: "모름",
            secondRankExternal: "모름",
        },
        frameHistory: {
            aRank: "모름",
            bRank: "모름",
            cRank: "모름",
        },
        accidentHistory: false,
        isRent: false,
        isRecallTarget: false,
        hasRecall: false,
    };

    try {
        // 엔카 성능기록부 열기
        const page: Page = await browser.newPage();
        await page.setViewport({
            width: 1200,
            height: 750,
        });

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // 요소가 로드될 때까지 대기
        const selector : string = '#bodydiv > div.body > div > div.inspec_carinfo > table > tbody > tr:nth-child(3) > td:nth-child(2)';
        await page.waitForSelector(selector, { visible: true, timeout: 100000 });

        // 1. 연식 추출
        result.year = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.inspec_carinfo > table > tbody > tr.start > td:nth-child(4)");
            if (ulElement) {
                return ulElement.innerText.trim();
            }
            throw new Error('Could not find year');
        });

        // 2. 차량명 추출
        result.carName = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.inspec_carinfo > table > tbody > tr.start > td.txt_bold");
            if (ulElement) {
                return ulElement.innerText.trim();
            }
            throw new Error('Could not find first registered date');
        });

        // 3. 차량번호 추출
        result.carNumber = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.inspec_carinfo > table > tbody > tr:nth-child(2) > td.txt_bold");
            if (ulElement) {
                return ulElement.innerText.trim();
            }
            throw new Error('Could not find first registered date');
        });

        // 4. 주행거리 추출
        result.mileage = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_total > table > tbody > tr:nth-child(2) > td:nth-child(3) > span");
            if (ulElement) {
                return Number(ulElement.innerText.replace(/[^\d]/g, '').trim());
            }
            throw new Error('Could not find mileage');
        });

        // 5. 연료방식 추출
        result.fuel = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.inspec_carinfo > table > tbody > tr:nth-child(4) > td:nth-child(2)");
            if (ulElement) {
                return ulElement.innerText.trim();
            }
            throw new Error('Could not find fuel');
        });

        // 6. 외판 교체 이력 추출
        result.externalHistory = await page.evaluate(() => {
            const externalHistory= {
                firstRankExternal: "모름",
                secondRankExternal: "모름",
            }

            const firstRank: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.detail_inspection_view > div.canv > ul > li.first > div.box_state > ul > li:nth-child(1) > ul");
            if (firstRank) {
                externalHistory.firstRankExternal = firstRank.innerText.trim();
            }

            const secondRank: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.detail_inspection_view > div.canv > ul > li.first > div.box_state > ul > li:nth-child(2) > ul");
            if (secondRank) {
                externalHistory.secondRankExternal = secondRank.innerText.trim();
            }

            if (externalHistory?.firstRankExternal && externalHistory?.secondRankExternal) {
                return externalHistory;
            }
            throw new Error('Could not find external history');
        });

        // 7. 주요 골격 교체 이력 추출
        result.frameHistory = await page.evaluate((result) => {
            const frameHistory = {
                aRank: "모름",
                bRank: "모름",
                cRank: "모름",
            };
            const aRank: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_repair > table > tbody > tr:nth-child(1) > td > span.txt_state.on");
            if (aRank) {
                frameHistory.aRank = aRank.innerText.trim();
            }

            const bRank: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_repair > table > tbody > tr:nth-child(1) > td > span.txt_state.on");
            if (bRank) {
                frameHistory.bRank = bRank.innerText.trim();
            }

            const cRank: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_repair > table > tbody > tr:nth-child(1) > td > span.txt_state.on");
            if (cRank) {
                frameHistory.cRank = cRank.innerText.trim();
            }

            if (frameHistory?.aRank && frameHistory?.bRank && frameHistory?.cRank) {
                return frameHistory;
            }

            throw new Error('Could not find frame history');
        }, result);

        // 8. 사고이력 추출
        result.accidentHistory = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_repair > table > tbody > tr:nth-child(1) > td > span.txt_state.on");
            if (ulElement) {
                return ulElement.innerText.trim() === "있음";
            }
            throw new Error('Could not find accident history');
        });

        // 9. 렌트이력 추출
        result.isRent = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_total > table > tbody > tr:nth-child(7) > td:nth-child(2) > span.txt_state.on");
            if (ulElement) {
                return ulElement.innerText.trim() === "있음";
            }
            throw new Error('Could not find rent history');
        });

        // 10. 리콜대상 여부 추출
        result.isRecallTarget = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_total > table > tbody > tr:nth-child(10) > td:nth-child(2) > span.txt_state.on");
            if (ulElement) {
                return ulElement.innerText.trim() === "해당";
            }
            throw new Error('Could not find is recall target');
        });

        // 11. 리콜 여부
        result.hasRecall = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#bodydiv > div.body > div > div.section_total > table > tbody > tr:nth-child(10) > td:nth-child(3) > span");
            if (ulElement) {
                return ulElement.innerText.trim() === "이행";
            }
            throw new Error('Could not find recall history');
        });

        return result;
    } catch (error) {
        console.error("❌ 오류 발생:", error);
        return result;
    } finally {
        await browser.close();
        console.log("차량성능기록부 크롤링 완료.");
    }
}

// "소유자변경횟수", "보험사고이력(내차피해)"
async function scrapeInsuranceHistory(carId: string): Promise<InsuranceHistory> {
    const url = `https://fem.encar.com/cars/report/accident/${carId}`;
    const browser: Browser = await puppeteer.launch({ headless: false });

    const result: InsuranceHistory = {
        ownerChangedCnt: 0,
        insuranceAccidentCnt: 0,
    }

    try {
        // 엔카 성능기록부 열기
        const page: Page = await browser.newPage();
        await page.setViewport({
            width: 1200,
            height: 750,
        });

        await page.goto(url, {waitUntil: 'domcontentloaded'});

        // 요소가 로드될 때까지 대기
        const selector: string = '#wrap > div > div.Layout_contents__MD95o > div:nth-child(2) > div.ReportAccidentSummary_info_summary__7gNID > ul > li:nth-child(3) > span > span:nth-child(2)';
        await page.waitForSelector(selector, { visible: true, timeout: 100000 });

        // 1. 소유자 변경횟수 추출
        result.ownerChangedCnt = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#wrap > div > div.Layout_contents__MD95o > div:nth-child(2) > div.ReportAccidentSummary_info_summary__7gNID > ul > li:nth-child(3) > span > span:nth-child(2)");
            console.log(ulElement);
            if (ulElement) {
                return Number(ulElement.innerText.trim().replace(/\D/g, ''));
            }
            throw new Error('Could not find owner changed count');
        });

        // 2. 보험사고이력(내차피해)
        result.insuranceAccidentCnt = await page.evaluate(() => {
            const ulElement: HTMLElement | null = document.querySelector("#wrap > div > div.Layout_contents__MD95o > div:nth-child(2) > div.ReportAccidentSummary_info_summary__7gNID > ul > li:nth-child(5) > span > span:nth-child(1)");
            console.log(ulElement);
            if (ulElement) {
                return Number(ulElement.innerText.trim().replace(/[^\d]/g, ''));
            }
            throw new Error('Could not find insurance accident changed count');
        });

        return result;
    } catch (error) {
        console.error("❌ 오류 발생:", error);
        return result;
    } finally {
        await browser.close();
        console.log("차량보험이력 크롤링 완료.");
    }
}

function makeCarDatas(carInfo: CarInfo, carHistory: CarHistory, insuranceHistory: InsuranceHistory): CarDatas {
    return {
        ...carInfo,
        ...carHistory,
        ...insuranceHistory,
    };
}

async function app(url: string) {
    const carInfo = await scrapeCarInfo(parseEncarUrl(url));
    if (carInfo.carId) {
        const carHistories= await scrapeCarHistory(carInfo.carId);
        const insuranceHistories = await scrapeInsuranceHistory(carInfo.carId);

        console.log("\n차량 등록번호: %s, 차량 가격: %s", carInfo.carId, carInfo.price);
        console.log(JSON.stringify(makeCarDatas(carInfo, carHistories, insuranceHistories), undefined, 2));
    }
    console.log("조회 종료.");

    try {
        await mongoClient.connect();

        const connectionResult = await mongoClient.db("sample_mflix").collection("users").find({ name: 'Andy' }).toArray();
        if (connectionResult) {
            console.log("pinged your deployment. successfully connected to MongoDB Atlas");
            console.log(JSON.stringify(connectionResult, undefined, 2));
        }
    } catch (error) {
        console.error("❌ db connection 오류 발생:", error);
    } finally {
        await mongoClient.close();
    }
}

// 실행
const url = "https://fem.encar.com/cars/detail/39060331";
app(url);
