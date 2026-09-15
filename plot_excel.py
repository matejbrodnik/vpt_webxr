import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


data = pd.read_excel("REPRO_MEASURE_2.xlsx", sheet_name="1-5")

t = data.iloc[2:, 0].to_numpy()
mse_ratios = [[],[],[],[]]
iter_ahead = [[],[],[],[]]

j = 2
for i in range(4):
    mse_ratios[i].append(data.iloc[2:, j].to_numpy())
    mse_ratios[i].append(data.iloc[2:, j+1].to_numpy())
    mse_ratios[i].append(data.iloc[2:, j+2].to_numpy())
    mse_ratios[i].append(data.iloc[2:, j+3].to_numpy())
    j+=4

j = 20
for i in range(4):
    iter_ahead[i].append(data.iloc[2:, j].to_numpy())
    iter_ahead[i].append(data.iloc[2:, j+1].to_numpy())
    iter_ahead[i].append(data.iloc[2:, j+2].to_numpy())
    iter_ahead[i].append(data.iloc[2:, j+3].to_numpy())
    j+=4

fig, axs = plt.subplots(2, 2)

fig.subplots_adjust(
    wspace=0.12,  # horizontal spacing
    hspace=0.2   # vertical spacing
)


x = t
y = mse_ratios[0][0]


def plot(list, set_ticks):
    axs[0, 0].set_title('1°')
    axs[0, 0].plot(x, list[0][0], 'c', label="2 iter.")
    axs[0, 0].plot(x, list[1][0], 'm', label="4 iter.")
    axs[0, 0].plot(x, list[2][0], "#20C020", label="8 iter.")
    axs[0, 0].plot(x, list[3][0], 'r', label="16 iter.")
    axs[0, 1].set_title('5°')
    axs[0, 1].plot(x, list[0][1], 'c')
    axs[0, 1].plot(x, list[1][1], 'm')
    axs[0, 1].plot(x, list[2][1], '#20C020')
    axs[0, 1].plot(x, list[3][1], 'r')
    axs[1, 0].set_title('10°')
    axs[1, 0].plot(x, list[0][2], 'c')
    axs[1, 0].plot(x, list[1][2], 'm')
    axs[1, 0].plot(x, list[2][2], '#20C020')
    axs[1, 0].plot(x, list[3][2], 'r')
    axs[1, 1].set_title('20°')
    axs[1, 1].plot(x, list[0][3], 'c')
    axs[1, 1].plot(x, list[1][3], 'm')
    axs[1, 1].plot(x, list[2][3], '#20C020')
    axs[1, 1].plot(x, list[3][3], 'r')

    if set_ticks:
        axs[0, 0].set_ylim(0, 10)
        axs[0, 0].set_yticks(np.arange(0, 11, 1))

        axs[0, 1].set_ylim(0, 10)
        axs[0, 1].set_yticks(np.arange(0, 11, 1))

        axs[1, 0].set_ylim(0, 10)
        axs[1, 0].set_yticks(np.arange(0, 11, 1))

        axs[1, 1].set_ylim(0, 10)
        axs[1, 1].set_yticks(np.arange(0, 11, 1))


    for ax in axs.flat:
        ax.set(xlabel='Čas [ms]', ylabel='Prednost [iter.]')
        ax.grid()
        ax.label_outer()
        ax.set_xlim(0, 300)
        # ax.set_ylim(0, 1.05)
        # ax.set_yticks(np.arange(0, 1, 0.1))

    fig.legend(
        loc="upper center",
        ncol=4,
        bbox_to_anchor=(0.5, 1.005),
        fontsize=12
    )

    # plt.yticks(np.arange(y.min(), y.max(), 1))
    # plt.tight_layout()
    
    plt.show()




def plot_t(list, set_ticks):
    axs[0, 0].set_title('2 iter.')
    axs[0, 0].plot(x, list[0][0], 'c', label="1°")
    axs[0, 0].plot(x, list[0][1], 'm', label="5°")
    axs[0, 0].plot(x, list[0][2], "#20C020", label="10°")
    axs[0, 0].plot(x, list[0][3], 'r', label="20°")
    axs[0, 1].set_title('4 iter.')
    axs[0, 1].plot(x, list[1][0], 'c')
    axs[0, 1].plot(x, list[1][1], 'm')
    axs[0, 1].plot(x, list[1][2], '#20C020')
    axs[0, 1].plot(x, list[1][3], 'r')
    axs[1, 0].set_title('8 iter.')
    axs[1, 0].plot(x, list[2][0], 'c')
    axs[1, 0].plot(x, list[2][1], 'm')
    axs[1, 0].plot(x, list[2][2], '#20C020')
    axs[1, 0].plot(x, list[2][3], 'r')
    axs[1, 1].set_title('16 iter.')
    axs[1, 1].plot(x, list[3][0], 'c')
    axs[1, 1].plot(x, list[3][1], 'm')
    axs[1, 1].plot(x, list[3][2], '#20C020')
    axs[1, 1].plot(x, list[3][3], 'r')

    if set_ticks:
        axs[0, 0].set_ylim(0, 11)
        axs[0, 0].set_yticks(np.arange(0, 11, 1))

        axs[0, 1].set_ylim(0, 11)
        axs[0, 1].set_yticks(np.arange(0, 11, 1))

        axs[1, 0].set_ylim(0, 9)
        axs[1, 0].set_yticks(np.arange(0, 11, 1))

        axs[1, 1].set_ylim(0, 9)
        axs[1, 1].set_yticks(np.arange(0, 11, 1))


    for ax in axs.flat:
        ax.set_xlabel("Čas [ms]", fontsize=12)
        ax.set_ylabel("Prednost [iter.]", fontsize=12)
        ax.grid()
        ax.label_outer()
        ax.set_xlim(0, 300)
        # ax.set_ylim(0, 1.05)
        # ax.set_yticks(np.arange(0, 1, 0.1))

    fig.legend(
        loc="upper center",
        ncol=4,
        bbox_to_anchor=(0.5, 1.005),
        fontsize=12
    )

    # plt.yticks(np.arange(y.min(), y.max(), 1))
    # plt.tight_layout()
    
    plt.show()

# plot(mse_ratios, False)
plot(iter_ahead, True)
# plot_t(iter_ahead, False)


# fig, ax = plt.subplots()

# ax.plot(t, mse_ratios[0][2], 'c', label="2 iter.")
# ax.plot(t, mse_ratios[1][2], 'm', label="4 iter.")
# ax.plot(t, mse_ratios[2][2], "#20C020", label="8 iter.")
# ax.plot(t, mse_ratios[3][2], 'r', label="16 iter.")

# ax.set_xlabel("Čas [ms]", fontsize=12)
# ax.set_ylabel("Razmerje MSE (usmerjeno/privzeto)", fontsize=12)
# # ax.set(xlabel='Čas [ms]', ylabel='Razmerje MSE (repro/privzeto)')
# ax.grid()
# ax.label_outer()
# ax.set_xlim(0, 300)
# ax.set_ylim(0, 1.05)
# ax.set_yticks(np.arange(0, 1.1, 0.1))

# fig.legend(
#     loc="upper center",
#     ncol=4,
#     bbox_to_anchor=(0.5, 1.0),
#     fontsize=12
# )

# plt.show()


