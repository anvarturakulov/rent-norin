import { Maindata } from "@/app/context/app.context.interfaces"

export const goToMainPage = (setMainData: Function| undefined, mainData: Maindata) => {
    setMainData && setMainData('mainPage', true)
    setMainData && setMainData('dashboardCurrentReportType', '')
}