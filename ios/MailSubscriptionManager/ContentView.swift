import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("概要", systemImage: "chart.bar.doc.horizontal")
                }

            AccountsView()
                .tabItem {
                    Label("アカウント", systemImage: "person.crop.circle.badge.checkmark")
                }

            SubscriptionsView()
                .tabItem {
                    Label("購読", systemImage: "tray.full")
                }

            ReportsView()
                .tabItem {
                    Label("分析", systemImage: "chart.pie")
                }

            SettingsView()
                .tabItem {
                    Label("設定", systemImage: "slider.horizontal.3")
                }
        }
        .tint(Color(red: 1.0, green: 0.4, blue: 0.0))
    }
}

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    MetricCard(title: "接続アカウント", value: "\(store.accounts.count)", systemImage: "mail.stack", color: .blue)
                    MetricCard(title: "購読メール", value: "\(store.activeSubscriptions.count)", systemImage: "tray.full", color: .teal)
                    MetricCard(title: "20通以上候補", value: "\(store.highRecommendationCount)", systemImage: "exclamationmark.triangle", color: .red)
                    MetricCard(title: "推定削減/月", value: "\(store.savedMailCount)通", systemImage: "scissors", color: .green)
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 12) {
                    Text("優先度が高い購読")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(topRecommendations) { subscription in
                        SubscriptionCard(subscription: subscription, compact: true)
                            .padding(.horizontal)
                    }
                }
                .padding(.top, 12)
            }
            .navigationTitle("ダッシュボード")
            .scrollContentBackground(.hidden)
            .background(Color.hackerBackground.ignoresSafeArea())
            .toolbar {
                Button {
                    store.syncAll()
                } label: {
                    Label("同期", systemImage: "arrow.clockwise")
                }
            }
        }
    }

    private var topRecommendations: [Subscription] {
        store.activeSubscriptions
            .sorted { $0.receiveCount30Days > $1.receiveCount30Days }
            .prefix(3)
            .map { $0 }
    }
}

struct AccountsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(store.accounts) { account in
                        HStack(spacing: 12) {
                            Image(systemName: "envelope.circle.fill")
                                .font(.title2)
                                .foregroundStyle(account.provider.tint)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(account.provider.rawValue)
                                    .font(.headline)
                                Text(account.email)
                                    .foregroundStyle(.secondary)
                                Text(account.syncedAt.map { "最終同期: \($0.formatted(date: .abbreviated, time: .shortened))" } ?? "未同期")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Text(account.isConnected ? "接続中" : "停止")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(account.isConnected ? Color.green.opacity(0.14) : Color.gray.opacity(0.16))
                                .foregroundStyle(account.isConnected ? .green : .secondary)
                                .clipShape(Capsule())
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
            .navigationTitle("アカウント")
            .scrollContentBackground(.hidden)
            .background(Color.hackerBackground.ignoresSafeArea())
            .toolbar {
                Button {
                    store.addDemoAccount()
                } label: {
                    Label("追加", systemImage: "plus")
                }
                .disabled(store.accounts.count >= 10)
            }
        }
    }
}

struct SubscriptionsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedProvider: MailProvider?
    @State private var selectedCategory: SubscriptionCategory?
    @State private var sort: SubscriptionSort = .frequencyHigh

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("並び替え", selection: $sort) {
                        ForEach(SubscriptionSort.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }
                    .pickerStyle(.segmented)

                    Picker("サービス", selection: $selectedProvider) {
                        Text("すべて").tag(MailProvider?.none)
                        ForEach(MailProvider.allCases) { provider in
                            Text(provider.rawValue).tag(Optional(provider))
                        }
                    }

                    Picker("カテゴリ", selection: $selectedCategory) {
                        Text("すべて").tag(SubscriptionCategory?.none)
                        ForEach(SubscriptionCategory.allCases) { category in
                            Text(category.rawValue).tag(Optional(category))
                        }
                    }
                }

                Section {
                    ForEach(filteredSubscriptions) { subscription in
                        SubscriptionCard(subscription: subscription)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .listRowSeparator(.hidden)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("購読一覧")
            .scrollContentBackground(.hidden)
            .background(Color.hackerBackground.ignoresSafeArea())
        }
    }

    private var filteredSubscriptions: [Subscription] {
        store.activeSubscriptions
            .filter { subscription in
                guard let selectedProvider else { return true }
                return store.account(for: subscription)?.provider == selectedProvider
            }
            .filter { subscription in
                guard let selectedCategory else { return true }
                return subscription.category == selectedCategory
            }
            .sorted { first, second in
                switch sort {
                case .frequencyHigh:
                    return first.receiveCount30Days > second.receiveCount30Days
                case .frequencyLow:
                    return first.receiveCount30Days < second.receiveCount30Days
                }
            }
    }
}

struct SubscriptionCard: View {
    @EnvironmentObject private var store: AppStore
    @State private var showsActionDialog = false
    var subscription: Subscription
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(subscription.senderName)
                        .font(.headline.weight(.semibold))
                    Text(subscription.senderDomain)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if store.groupedCount(for: subscription) > 1 {
                        Label("名寄せ \(store.groupedCount(for: subscription))件", systemImage: "link")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(subscription.receiveCount30Days)通")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Color.hackerOrange)
                    Text("30日")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }

            HStack {
                Label(store.account(for: subscription)?.provider.rawValue ?? "不明", systemImage: "envelope")
                Label(subscription.category.rawValue, systemImage: "tag")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack {
                Text("30日 \(subscription.receiveCount30Days)通")
                Spacer()
                Text("最終開封 \(subscription.lastOpenedDays)日前")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if !compact {
                HStack {
                    Button(role: .destructive) {
                        showsActionDialog = true
                    } label: {
                        Label("解除", systemImage: "trash")
                    }
                    .buttonStyle(HackerButtonStyle())

                    Button {
                        store.keep(subscription)
                    } label: {
                        Label("保持", systemImage: "checkmark.circle")
                    }
                    .buttonStyle(HackerButtonStyle())
                }
            }
        }
        .padding(12)
        .background(Color.hackerPanel)
        .overlay(Rectangle().stroke(Color.hackerLine, lineWidth: 1))
        .confirmationDialog("迷惑メールに登録しますか？", isPresented: $showsActionDialog, titleVisibility: .visible) {
            Button("はい、迷惑メールに登録", role: .destructive) {
                store.unsubscribe(subscription, action: .markSpam)
            }
            Button("いいえ、削除だけ", role: .destructive) {
                store.unsubscribe(subscription, action: .trashOnly)
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("迷惑メール登録を選ぶと、今後の同じ送信元も迷惑メール扱いになりやすくなります。削除だけを選ぶと、現在の対象メールだけを処理します。")
        }
    }
}

struct ReportsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List {
                Section("解除実績") {
                    LabeledContent("解除済み", value: "\(store.unsubscribedSubscriptions.count)件")
                    LabeledContent("推定削減メール", value: "\(store.savedMailCount)通/月")
                    LabeledContent("推定節約時間", value: "\(store.estimatedTimeSavedMinutes)分/月")

                    ForEach(store.unsubscribedSubscriptions) { subscription in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(subscription.senderName)
                                Text(subscription.senderDomain)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let action = subscription.lastAction {
                                Text(action.label)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Button("戻す") {
                                store.restore(subscription)
                            }
                        }
                    }
                }

                Section("カテゴリ別受信数") {
                    ForEach(categoryReport, id: \.category) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.category.rawValue)
                                Spacer()
                                Text("\(item.count)通")
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: Double(item.count), total: Double(maxCategoryCount))
                                .tint(.teal)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("分析")
            .scrollContentBackground(.hidden)
            .background(Color.hackerBackground.ignoresSafeArea())
        }
    }

    private var categoryReport: [(category: SubscriptionCategory, count: Int)] {
        SubscriptionCategory.allCases.map { category in
            let count = store.subscriptions
                .filter { $0.category == category }
                .reduce(0) { $0 + $1.receiveCount30Days }
            return (category, count)
        }
        .filter { $0.count > 0 }
    }

    private var maxCategoryCount: Int {
        categoryReport.map(\.count).max() ?? 1
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var opened: Double = 55
    @State private var category: Double = 30
    @State private var frequency: Double = 15

    var body: some View {
        NavigationStack {
            Form {
                Section("スコアリング重み") {
                    SliderRow(title: "最終開封日", value: $opened)
                    SliderRow(title: "カテゴリ", value: $category)
                    SliderRow(title: "受信頻度", value: $frequency)

                    Button("重みを保存") {
                        store.updateWeights(opened: opened, category: category, frequency: frequency)
                    }
                }

                Section("データ") {
                    Button("デモデータに戻す", role: .destructive) {
                        store.resetDemoData()
                        loadWeights()
                    }
                }
            }
            .navigationTitle("設定")
            .scrollContentBackground(.hidden)
            .background(Color.hackerBackground.ignoresSafeArea())
            .onAppear(perform: loadWeights)
        }
    }

    private func loadWeights() {
        opened = store.weights.opened
        category = store.weights.category
        frequency = store.weights.frequency
    }
}

struct MetricCard: View {
    var title: String
    var value: String
    var systemImage: String
    var color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(color)
            Text(value)
                .font(.largeTitle.weight(.bold))
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.hackerPanel)
        .overlay(Rectangle().stroke(Color.hackerLine, lineWidth: 1))
    }
}

struct SliderRow: View {
    var title: String
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(title)
                Spacer()
                Text("\(Int(value))%")
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: 0...100, step: 1)
        }
    }
}

enum SubscriptionSort: String, CaseIterable, Identifiable {
    case frequencyHigh
    case frequencyLow

    var id: String { rawValue }

    var title: String {
        switch self {
        case .frequencyHigh: return "多い順"
        case .frequencyLow: return "少ない順"
        }
    }
}

struct HackerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(configuration.isPressed ? Color.hackerPressed : Color.hackerPanel)
            .overlay(Rectangle().stroke(Color.hackerLine, lineWidth: 1))
    }
}

extension Color {
    static let hackerOrange = Color(red: 1.0, green: 0.4, blue: 0.0)
    static let hackerBackground = Color(red: 0.964, green: 0.964, blue: 0.902)
    static let hackerPanel = Color(red: 1.0, green: 0.996, blue: 0.94)
    static let hackerLine = Color(red: 0.85, green: 0.83, blue: 0.74)
    static let hackerPressed = Color(red: 1.0, green: 0.95, blue: 0.82)
}
