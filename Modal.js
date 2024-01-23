import React, { Component } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, Alert } from 'react-native';

export default class CustomModal extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={this.props.visible}
                onRequestClose={() => {
                    Alert.alert("Modal has been closed.");
                }}
                style={styles.backgroundModal}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <TouchableOpacity
                            style={styles.close}
                            onPress={() => {
                                this.props.close();
                            }}
                        >
                            <Image
                                source={require('./assets/modal_close.png')}
                            />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{this.props.title}</Text>
                        <Text style={styles.modalText}>{this.props.text}</Text>
                
                        <TouchableOpacity
                        style={styles.modalClose}
                        onPress={() => {
                            this.props.close();
                        }}
                        >
                            <Text style={styles.modalCloseText}>{this.props.closeText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        )
    }
}

const styles = StyleSheet.create({
    centeredView: {
        backgroundColor: 'rgba(51, 65, 75, 0.3)',
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 22,
        padding: 30
      },
      modalView: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 30,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        width: '100%'
      },
      modalTitle: {
        color: '#222222',
        fontSize: 22,
        marginBottom: 15,
        fontWeight: '300'
      },
      modalText: {
        color: '#666666',
        fontSize: 14,
        marginBottom: 15,
        fontWeight: '300'
      },
      modalClose: {
        backgroundColor: '#F1F1F1',
        borderColor: '#FF4343',
        borderWidth: 1,
        padding: 15,
        width: '100%',
        borderRadius: 10
      },
      modalCloseText: {
        color: '#FF4343',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: 'bold'
      },
      close: {
        alignItems: 'flex-end'
      }
})