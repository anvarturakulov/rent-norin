'use client'
import styles from './page.module.css';
import ReportWindow from '@/app/components/reports/simpleReports/reportWindow/reportWindow';
import { useAppContext } from '@/app/context/app.context';
import { Message } from '@/app/components/common/message/message';
import PaymentLessThanIncomeModal from '@/app/components/documents/document/docValues/components/paymentLessThanIncomeModal/paymentLessThanIncomeModal';
import ReadyRentalOrdersModal from '@/app/components/documents/document/readyRentalOrdersModal/readyRentalOrdersModal';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceType } from '@/app/interfaces/general.interface';
import Journal from '@/app/components/journals/journal/journal';
import { IntervalWindow } from '@/app/components/windows/intervalWindow/intervalWindow';
import TopBox from '@/app/components/common/topBox/topBox';
import { Inform } from '@/app/components/reports/dashboardReports/inform';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getStoredUser } from '@/app/service/common/authStorage';
import UsersList from '@/app/components/lists/usersList/usersList';
import ReferencesList from '@/app/components/lists/referencesList/referencesList';
import GateJournal from '@/app/components/journals/gateJournal/gateJournal';
import SettingsJournal from '@/app/components/journals/settingsJournal/settingsJournal';
import FurnitureOrdersJournal from '@/app/components/furnitureOrders/furnitureOrdersJournal/furnitureOrdersJournal';
import ContractsJournal from '@/app/components/clientContracts/contractsJournal/contractsJournal';
import RentalContractsJournal from '@/app/components/rentalContracts/rentalContractsJournal/rentalContractsJournal';
import WorkerWorksJournal from '@/app/components/furnitureOrders/workerWorksJournal/workerWorksJournal';
import ProductionWorkBoard from '@/app/components/furnitureOrders/productionWorkBoard/productionWorkBoard';
import OrdersStageBoard from '@/app/components/furnitureOrders/ordersStageBoard/ordersStageBoard';
import CuttingBalancesJournal from '@/app/components/furnitureOrders/cuttingBalancesJournal/cuttingBalancesJournal';
import WorkTimeReport from '@/app/components/furnitureOrders/workTimeReport/workTimeReport';
import EnterprisesList from '@/app/components/lists/enterprisesList/enterprisesList';
import { PricingPolicyPage } from '@/app/components/pricingPolicy/pricingPolicyPage';

export default function Dashboard() {

  const router = useRouter();
  const {mainData, setMainData} = useAppContext()
  const { mainPage } = mainData.window
  const { contentType, contentTitle, contentName } = mainData.document
  const { user } = mainData.users

  const token = user?.token;
  const url = process.env.NEXT_PUBLIC_DOMAIN + '/api/users/names/';
  const usersNamesKey = token ? url : null;
  const { data: usersName, mutate } = useSWR(usersNamesKey, (fetchUrl) =>
    getDataForSwr(fetchUrl, token),
  );
  
  useEffect(() => {
    // Ждём восстановления user из sessionStorage / last-login, чтобы F5 не выкидывал на логин.
    if (user == undefined && !getStoredUser()) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (usersName && usersName.length>0) {
      setMainData && setMainData('usersName', usersName)
    }
  }, [usersName]);

  return (
    
    <div className={styles.dashboard}>
      <div className={styles.container}>
        {/* <TopBox/> */}
        <div className={styles.content}>
        

          {mainPage && 
          <div className={styles.informBox}>
            
            <Inform/>
          </div>
          }
          
          <div className={styles.journalBox}>
            { !mainPage && contentType=='document' && <Journal/> }
          </div>

          <div className={styles.journalBox}>
            { !mainPage && contentType=='reference' && <ReferencesList key={contentName} /> }
          </div>

          <div className={styles.journalBox}>
            { !mainPage && contentType=='servis' && contentTitle == ServiceType.Users && <UsersList/> }
            { !mainPage && contentType=='servis' && contentTitle == ServiceType.Enterprises && <EnterprisesList/> }
            { !mainPage && contentType=='servis' && contentTitle == ServiceType.Options && <SettingsJournal/> }
            { !mainPage && contentType=='servis' && contentTitle == ServiceType.PricingPolicy && <PricingPolicyPage/> }
          </div>

          <div className={styles.journalBox}>
            { !mainPage && contentType == 'report' && <ReportWindow /> }
          </div>

          <div className={styles.journalBox}>
            { !mainPage && (contentType === 'gate-income' || contentType === 'gate-outcome') && <GateJournal /> }
          </div>

          <div className={styles.journalBox}>
            { !mainPage && contentType === 'furniture-orders' && <FurnitureOrdersJournal /> }
            { !mainPage && contentType === 'furniture-contracts' && <ContractsJournal /> }
            { !mainPage && contentType === 'furniture-my-works' && <WorkerWorksJournal /> }
            { !mainPage && contentType === 'furniture-production-board' && <ProductionWorkBoard /> }
            { !mainPage && contentType === 'furniture-stage-board' && <OrdersStageBoard /> }
            { !mainPage && contentType === 'furniture-cutting-balances' && <CuttingBalancesJournal /> }
            { !mainPage && contentType === 'furniture-work-time-report' && <WorkTimeReport /> }
            { !mainPage && contentType === 'rental-contracts' && <RentalContractsJournal /> }
          </div>
        </div>
        <IntervalWindow/>

      </div>
      <Message/>
      <PaymentLessThanIncomeModal
        open={Boolean(mainData.window.showPaymentLessThanIncomeModal)}
        onClose={() => setMainData && setMainData('showPaymentLessThanIncomeModal', false)}
      />
      <ReadyRentalOrdersModal
        open={Boolean(mainData.window.showReadyRentalOrdersModal)}
        payload={mainData.window.rentalReadyOrders}
        onOk={() => setMainData && setMainData('showReadyRentalOrdersModal', false)}
      />
    </div>
  )
}
