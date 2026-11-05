import { useId } from "react";
import { normalizeSiStopSettings, type SiStopSettings } from "./siStops";
import { SettingFieldLabel } from "./SettingHelp";

export function SiStopSettingsEditor({ settings, onChange }: {
  settings: SiStopSettings; onChange: (settings: SiStopSettings) => void;
}) {
  const id = useId();
  const patch = (change: Partial<SiStopSettings>) => onChange(normalizeSiStopSettings({ ...settings, ...change }));
  const check = (field: keyof SiStopSettings, label: string, help: string, disabled = false) => (
    <div className="liquidity-settings-field market-explorer-check-field">
      <SettingFieldLabel label={label} help={help} htmlFor={`${id}-${field}`} />
      <input id={`${id}-${field}`} type="checkbox" checked={settings[field] === true} disabled={disabled}
        onChange={(e) => patch({ [field]: e.target.checked })} />
    </div>
  );
  const number = (field: keyof SiStopSettings, label: string, min: number, max: number,
    help: string, disabled = false, step = 1) => (
    <div className="liquidity-settings-field">
      <SettingFieldLabel label={label} help={help} htmlFor={`${id}-${field}`} />
      <input id={`${id}-${field}`} type="number" value={Number(settings[field])} min={min} max={max} step={step}
        disabled={disabled} onChange={(e) => {
          if (Number.isFinite(e.target.valueAsNumber)) patch({ [field]: e.target.valueAsNumber });
        }} />
    </div>
  );
  return (
    <fieldset className="liquidity-settings-group si-stops-settings-group">
      <legend>SI Stops</legend>
      {check("enabled", "Show SI Stops", "Hiển thị các chuỗi khớp lệnh được SI suy luận là hoạt động stop. Chỉ chain đã hoàn tất mới có marker; đây không phải xác nhận loại lệnh từ sàn.")}
      <p className="si-stops-settings-help">Filter each chain first. The marker number is the total contracts after grouping.</p>
      <div className="si-stops-settings-columns">
        <section aria-label="SI Stops chain filter">
          <h4>Chain filter</h4>
          <div className={settings.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
            {check("automatic", "Automatic size filter", "Tự tính ngưỡng từ các chain hoàn tất trong khoảng lấy mẫu, cập nhật mỗi phút. Khi bật, Auto thay thế ngưỡng cố định Minimum executed volume.", !settings.enabled)}
            {number("minVolume", "Minimum executed volume", 0, 10_000_000,
              "Số contracts đã khớp tối thiểu của TỪNG chain trước khi gộp. Min 50 loại chain dưới 50, dù nhiều chain nhỏ cộng lại đạt 50. Giao dịch dùng làm seed ban đầu không tính vào volume.", !settings.enabled || settings.automatic)}
            {number("intervalMinutes", "Sample interval (minutes)", 1, 2880,
              "Số phút nhìn lại để Auto lấy mẫu các chain hoàn tất đã tải. Ví dụ 60 là một giờ gần nhất, không phụ thuộc mức zoom của chart.", !settings.enabled || !settings.automatic)}
            {number("standardDeviations", "Standard deviations", 0, 10,
              "Auto = trung bình volume + hệ số này × độ lệch chuẩn, làm tròn xuống và không vượt mẫu lớn nhất. Hệ số cao hơn thường lọc khắt khe hơn; chưa có mẫu thì ngưỡng là 0.", !settings.enabled || !settings.automatic, 0.1)}
            {check("throughPriceLevelsOnly", "Through price levels only",
              "Chỉ hiện chain có ít nhất hai bản ghi khớp và giá khớp đầu khác giá khớp cuối. Tắt để nhận cả chain khớp tại cùng một mức giá.", !settings.enabled)}
            {(["buyColor", "sellColor"] as const).map((key) => {
              const label = key === "buyColor" ? "Buy SI Stops" : "Sell SI Stops";
              return <div key={key} className="liquidity-settings-field market-explorer-color-field">
                <SettingFieldLabel label={label} htmlFor={`${id}-${key}`}
                  help={key === "buyColor" ? "Màu marker của chain chủ động mua. Chỉ đổi cách hiển thị, không đổi logic nhận diện." : "Màu marker của chain chủ động bán. Chỉ đổi cách hiển thị, không đổi logic nhận diện."} />
                <input id={`${id}-${key}`} type="color" value={settings[key]} disabled={!settings.enabled}
                  onChange={(e) => patch({ [key]: e.target.value })} />
              </div>;
            })}
          </div>
        </section>
        <section aria-label="SI Stops grouping and alerts">
          <h4>Grouping &amp; alerts</h4>
          <div className="liquidity-settings-fields">
            {check("aggregate", "Aggregate nearby chains", "Gộp marker gần nhau và cùng chiều Buy/Sell. Số trên marker là tổng contracts của nhóm; tooltip ghi riêng số chain và số bản ghi khớp. Không gộp danh tính hay cảnh báo của chain.", !settings.enabled)}
            {number("aggregateMinVolume", "Aggregate minimum volume", 0, 10_000_000,
              "Ngưỡng tổng contracts của nhóm, áp dụng SAU khi lọc từng chain và gộp. Không thể dùng các chain bị loại để cộng đủ ngưỡng. 0 bỏ qua ngưỡng phụ này.", !settings.enabled)}
            {number("timeArea", "Aggregation time area", 0, 1000,
              "Khoảng gộp theo chiều ngang màn hình, không phải số giây. 10 xấp xỉ một bề rộng marker; tăng để gộp xa hơn. Nhóm có thể thay đổi khi zoom.", !settings.enabled || !settings.aggregate)}
            {number("priceArea", "Aggregation price area", 0, 1000,
              "Khoảng gộp theo chiều dọc màn hình, không phải số ticks. 10 xấp xỉ một chiều cao marker; tăng để gộp các giá xa nhau hơn. Nhóm có thể thay đổi khi zoom.", !settings.enabled || !settings.aggregate)}
            {check("showFiltered", "Show filtered markers", "Hiện mờ các marker không đạt bộ lọc thay vì ẩn hẳn. Các marker đạt và không đạt được gộp riêng.", !settings.enabled)}
            {number("filteredOpacity", "Filtered opacity", 0, 1,
              "Độ rõ của marker không đạt bộ lọc: 0 là trong suốt, 1 là rõ hoàn toàn. Ví dụ 0.15 tương đương 15%. Chỉ dùng khi Show filtered markers bật.", !settings.enabled || !settings.showFiltered, 0.05)}
            {number("alertMinVolume", "Alert minimum volume", 0, 10_000_000,
              "Ngưỡng contracts của từng chain mới để phát âm hoặc popup. Độc lập với bộ lọc hiển thị và tổng volume của nhóm; chỉnh min hiển thị không tự đổi ngưỡng này.", !settings.enabled)}
            {check("alertThroughPriceLevelsOnly", "Alert through price levels only",
              "Chỉ cảnh báo khi chain có ít nhất hai bản ghi khớp, giá đầu khác giá cuối. Đây là điều kiện riêng cho cảnh báo, không thay đổi marker.", !settings.enabled)}
            {check("showToast", "Popup notification", "Hiện thông báo cho chain mới hoàn tất đủ ngưỡng cảnh báo. Mỗi chain báo tối đa một lần; tải lịch sử hoặc reconnect không báo lại.", !settings.enabled)}
          </div>
        </section>
      </div>
    </fieldset>
  );
}
