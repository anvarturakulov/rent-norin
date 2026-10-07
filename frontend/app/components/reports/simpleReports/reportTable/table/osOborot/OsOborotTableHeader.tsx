import styles from './osOborot.module.css';

export const OsOborotTableHeader = (): JSX.Element => (
  <thead>
    <tr>
      <td className={styles.stickyCol} rowSpan={2}>
        №
      </td>
      <td className={styles.stickyCol} rowSpan={2}>
        Наименование
      </td>
      <td className={styles.stickyCol} rowSpan={2}>
        Артикул
      </td>
      <td className={styles.groupHead} colSpan={3}>
        Бошлангич колдик
      </td>
      <td className={styles.groupHead} colSpan={2}>
        Кирим
      </td>
      <td className={styles.groupHead} colSpan={2}>
        Чиким
      </td>
      <td className={styles.groupHead} colSpan={3}>
        Охирги колдик
      </td>
    </tr>
    <tr>
      <td className={styles.subHead}>Баланс киймат</td>
      <td className={styles.subHead}>Амортизация</td>
      <td className={styles.subHead}>Колдик киймат</td>
      <td className={styles.subHead}>Асосий восита</td>
      <td className={styles.subHead}>Амортизация</td>
      <td className={styles.subHead}>Асосий восита</td>
      <td className={styles.subHead}>Амортизация</td>
      <td className={styles.subHead}>Баланс киймат</td>
      <td className={styles.subHead}>Амортизация</td>
      <td className={styles.subHead}>Колдик киймат</td>
    </tr>
  </thead>
);
